//! Ledger hardware approval gate — EIP-712 signing integration.
//!
//! High-value agent actions require physical Ledger approval via the
//! Ledger Ethereum app. This module manages the approval flow using
//! EIP-712 typed data signing.

use anyhow::{Context, Result};
use coins_ledger::{common::APDUData, transports::LedgerAsync, APDUCommand, Ledger};
use ethers::types::{Address, U256};

/// BIP-44 derivation path for Ethereum: m/44'/60'/0'/0/0
const BIP32_PATH: [u32; 5] = [
    0x8000_002C, // 44'
    0x8000_003C, // 60'
    0x8000_0000, // 0'
    0x0000_0000, // 0
    0x0000_0000, // 0
];

/// Ledger Ethereum app APDU constants.
const ETH_CLA: u8 = 0xE0;
const INS_SIGN_EIP712: u8 = 0x0C;

/// Default chain ID (Sepolia testnet).
const DEFAULT_CHAIN_ID: u64 = 11155111;

/// EIP-712 domain name matching the ProofOfClaw contract.
const DOMAIN_NAME: &str = "ProofOfClaw";
const DOMAIN_VERSION: &str = "1";

/// EIP-712 signature components.
#[derive(Debug, Clone)]
pub struct Eip712Signature {
    pub v: u8,
    pub r: [u8; 32],
    pub s: [u8; 32],
}

/// Parameters for an action requiring Ledger approval.
/// Fields match the on-chain `ActionApproval` EIP-712 struct exactly.
#[derive(Debug, Clone)]
pub struct ActionApproval {
    pub agent_id: [u8; 32],
    pub output_commitment: [u8; 32],
    pub action_value: u64,
}

/// Gate that requests physical Ledger approval for high-value actions.
pub struct LedgerApprovalGate {
    chain_id: u64,
    verifier_address: Address,
    bip32_path: Vec<u32>,
}

impl LedgerApprovalGate {
    pub fn new(
        chain_id: Option<u64>,
        verifier_address: Option<String>,
    ) -> Self {
        let address = verifier_address
            .and_then(|a| a.parse::<Address>().ok())
            .unwrap_or_default();

        Self {
            chain_id: chain_id.unwrap_or(DEFAULT_CHAIN_ID),
            verifier_address: address,
            bip32_path: BIP32_PATH.to_vec(),
        }
    }

    /// Create a gate with a custom BIP-44 account index (default is 0).
    pub fn with_account_index(mut self, index: u32) -> Self {
        if self.bip32_path.len() == 5 {
            self.bip32_path[4] = index;
        }
        self
    }

    /// Request Ledger approval for an action via EIP-712 signing.
    ///
    /// Returns the signature if the user approves on device, `None` if rejected.
    /// Returns `Err` if communication fails unexpectedly.
    pub async fn request_approval(
        &self,
        approval: &ActionApproval,
    ) -> Result<Option<Eip712Signature>> {
        tracing::info!(
            "Ledger approval requested: agent=0x{}..., value={} wei",
            hex::encode(&approval.agent_id[..4]),
            approval.action_value,
        );

        let domain_separator = self.compute_domain_separator();
        let message_hash = Self::compute_message_hash(approval);

        match self.sign_eip712_on_ledger(&domain_separator, &message_hash).await {
            Ok(Some(sig)) => {
                tracing::info!(
                    "Ledger approval granted (v={}, r=0x{}..., s=0x{}...)",
                    sig.v,
                    hex::encode(&sig.r[..4]),
                    hex::encode(&sig.s[..4]),
                );
                Ok(Some(sig))
            }
            Ok(None) => {
                tracing::warn!("User rejected action on Ledger device");
                Ok(None)
            }
            Err(e) => {
                Err(e).context(
                    "Ledger device required for this action but communication failed. \
                     Connect a Ledger device with the Ethereum app open and retry."
                )
            }
        }
    }

    /// Connect to the Ledger device and send an EIP-712 signing request.
    async fn sign_eip712_on_ledger(
        &self,
        domain_separator: &[u8; 32],
        message_hash: &[u8; 32],
    ) -> Result<Option<Eip712Signature>> {
        let ledger = self.connect_ledger().await?;

        // Build APDU payload: BIP32 path length (1 byte) + path elements (4 bytes each)
        // + domain separator hash (32 bytes) + message hash (32 bytes)
        let mut data = Vec::with_capacity(1 + self.bip32_path.len() * 4 + 64);

        data.push(self.bip32_path.len() as u8);
        for &element in &self.bip32_path {
            data.extend_from_slice(&element.to_be_bytes());
        }

        data.extend_from_slice(domain_separator);
        data.extend_from_slice(message_hash);

        let command = APDUCommand {
            cla: ETH_CLA,
            ins: INS_SIGN_EIP712,
            p1: 0x00,
            p2: 0x00,
            data: APDUData::new(&data),
            response_len: None,
        };

        let response = ledger
            .exchange(&command)
            .await
            .context("Failed to send EIP-712 signing request to Ledger")?;

        // Status word 0x6985 = user rejected on device
        if response.retcode() == 0x6985 {
            return Ok(None);
        }

        if response.retcode() != 0x9000 {
            anyhow::bail!(
                "Ledger returned error status: 0x{:04X}",
                response.retcode()
            );
        }

        let response_data = response
            .data()
            .context("Ledger returned success status but no data")?;

        // Parse signature: v (1 byte) + r (32 bytes) + s (32 bytes) = 65 bytes
        if response_data.len() < 65 {
            anyhow::bail!(
                "Unexpected Ledger response length: {} (expected 65)",
                response_data.len()
            );
        }

        let v = response_data[0];
        let mut r = [0u8; 32];
        let mut s = [0u8; 32];
        r.copy_from_slice(&response_data[1..33]);
        s.copy_from_slice(&response_data[33..65]);

        Ok(Some(Eip712Signature { v, r, s }))
    }

    /// Connect to a Ledger device via USB HID.
    async fn connect_ledger(&self) -> Result<Ledger> {
        Ledger::init()
            .await
            .context("Failed to connect to Ledger device — is it plugged in with the Ethereum app open?")
    }

    /// Compute the EIP-712 domain separator hash.
    ///
    /// ```text
    /// keccak256(abi.encode(
    ///     keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    ///     keccak256(name),
    ///     keccak256(version),
    ///     chainId,
    ///     verifyingContract
    /// ))
    /// ```
    fn compute_domain_separator(&self) -> [u8; 32] {
        use ethers::utils::keccak256;

        let type_hash = keccak256(
            b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
        );
        let name_hash = keccak256(DOMAIN_NAME.as_bytes());
        let version_hash = keccak256(DOMAIN_VERSION.as_bytes());

        let mut chain_id_bytes = [0u8; 32];
        U256::from(self.chain_id).to_big_endian(&mut chain_id_bytes);

        let mut address_bytes = [0u8; 32];
        address_bytes[12..32].copy_from_slice(self.verifier_address.as_bytes());

        let mut encoded = Vec::with_capacity(5 * 32);
        encoded.extend_from_slice(&type_hash);
        encoded.extend_from_slice(&name_hash);
        encoded.extend_from_slice(&version_hash);
        encoded.extend_from_slice(&chain_id_bytes);
        encoded.extend_from_slice(&address_bytes);

        keccak256(&encoded)
    }

    /// Compute the EIP-712 struct hash for an ActionApproval.
    ///
    /// Matches the on-chain `APPROVAL_TYPEHASH`:
    /// ```text
    /// ActionApproval(bytes32 agentId,bytes32 outputCommitment,uint256 actionValue)
    /// ```
    fn compute_message_hash(approval: &ActionApproval) -> [u8; 32] {
        use ethers::utils::keccak256;

        let type_hash = keccak256(
            b"ActionApproval(bytes32 agentId,bytes32 outputCommitment,uint256 actionValue)",
        );

        let mut value_bytes = [0u8; 32];
        U256::from(approval.action_value).to_big_endian(&mut value_bytes);

        let mut encoded = Vec::with_capacity(4 * 32);
        encoded.extend_from_slice(&type_hash);
        encoded.extend_from_slice(&approval.agent_id);
        encoded.extend_from_slice(&approval.output_commitment);
        encoded.extend_from_slice(&value_bytes);

        keccak256(&encoded)
    }

    /// Returns the configured chain ID.
    pub fn chain_id(&self) -> u64 {
        self.chain_id
    }

    /// Returns the verifier contract address used in the EIP-712 domain.
    pub fn verifier_address(&self) -> Address {
        self.verifier_address
    }
}

/// Hash an agent ID string to bytes32 (matches Solidity `keccak256(bytes(agentId))`).
fn compute_agent_id_hash(agent_id: &str) -> [u8; 32] {
    ethers::utils::keccak256(agent_id.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn domain_separator_is_deterministic() {
        let gate = LedgerApprovalGate::new(Some(11155111), None);
        let sep1 = gate.compute_domain_separator();
        let sep2 = gate.compute_domain_separator();
        assert_eq!(sep1, sep2);
        assert_ne!(sep1, [0u8; 32]);
    }

    #[test]
    fn domain_separator_changes_with_chain_id() {
        let gate1 = LedgerApprovalGate::new(Some(1), None);
        let gate2 = LedgerApprovalGate::new(Some(11155111), None);
        assert_ne!(
            gate1.compute_domain_separator(),
            gate2.compute_domain_separator()
        );
    }

    #[test]
    fn message_hash_includes_all_fields() {
        let approval = ActionApproval {
            agent_id: [0xAA; 32],
            output_commitment: [0xCC; 32],
            action_value: 10_000_000_000_000_000_000,
        };
        let hash1 = LedgerApprovalGate::compute_message_hash(&approval);

        // Different output_commitment → different hash
        let approval2 = ActionApproval {
            output_commitment: [0xDD; 32],
            ..approval.clone()
        };
        let hash2 = LedgerApprovalGate::compute_message_hash(&approval2);
        assert_ne!(hash1, hash2);

        // Different action_value → different hash
        let approval3 = ActionApproval {
            action_value: 1_000_000_000_000_000_000,
            ..approval.clone()
        };
        let hash3 = LedgerApprovalGate::compute_message_hash(&approval3);
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn agent_id_hash_matches_keccak() {
        let hash = compute_agent_id_hash("test-agent");
        assert_eq!(hash, ethers::utils::keccak256(b"test-agent"));
    }

    #[test]
    fn custom_account_index() {
        let gate = LedgerApprovalGate::new(None, None).with_account_index(3);
        assert_eq!(gate.bip32_path[4], 3);
    }
}
