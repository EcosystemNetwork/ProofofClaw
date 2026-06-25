// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/RiscZeroGroth16Verifier.sol";
import "../src/ProofOfClawVerifier.sol";
import "../src/ProofOfClawINFT.sol";
import "../src/SoulVaultSwarm.sol";
import "../src/SoulVaultERC8004RegistryAdapter.sol";
import "../src/EIP8004Integration.sol";

/// @title DeployMultiChain — Unified deployment script for all supported chains
/// @notice Deploys the full Proof of Claw contract suite to any supported chain.
///         Chain selection is automatic based on the RPC endpoint's chain ID.
///
/// Usage:
///   source .env && forge script script/DeployMultiChain.s.sol \
///     --rpc-url $RPC_URL --broadcast --verify
///
/// Required env vars:
///   PRIVATE_KEY        — Deployer wallet
///   RISC_ZERO_IMAGE_ID — RISC Zero guest image ID (bytes32)
///
/// Optional env vars:
///   ETHERSCAN_API_KEY  — For contract verification on Etherscan-compatible explorers
///   DEPLOY_FULL_SUITE  — Set to "true" to deploy all contracts (default: core only)
contract DeployMultiChainScript is Script {
    // ── Chain IDs ────────────────────────────────────────────────────────────
    uint256 constant CHAIN_SEPOLIA     = 11155111;
    uint256 constant CHAIN_MAINNET     = 1;
    uint256 constant CHAIN_0G_TESTNET  = 16602;
    uint256 constant CHAIN_0G_MAINNET  = 16605;

    struct DeployResult {
        address groth16Verifier;
        address proofOfClaw;
        address inft;
        address swarm;
        address registryAdapter;
        address eip8004;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        bytes32 imageId = vm.envBytes32("RISC_ZERO_IMAGE_ID");
        bool fullSuite = _envBool("DEPLOY_FULL_SUITE", true);
        uint256 chainId = block.chainid;

        _validateChain(chainId);
        _printHeader(chainId);

        vm.startBroadcast(deployerPrivateKey);

        DeployResult memory r;

        // 1. RISC Zero Groth16 verifier
        r.groth16Verifier = address(new RiscZeroGroth16Verifier());
        console.log("  [1/6] RiscZeroGroth16Verifier:", r.groth16Verifier);

        // 2. ProofOfClawVerifier
        r.proofOfClaw = address(new ProofOfClawVerifier(
            IRiscZeroVerifier(r.groth16Verifier),
            imageId
        ));
        console.log("  [2/6] ProofOfClawVerifier:    ", r.proofOfClaw);

        if (fullSuite) {
            // 3. iNFT (ERC-7857)
            r.inft = address(new ProofOfClawINFT(r.proofOfClaw));
            console.log("  [3/6] ProofOfClawINFT:       ", r.inft);

            // 4. SoulVaultSwarm
            r.swarm = address(new SoulVaultSwarm());
            console.log("  [4/6] SoulVaultSwarm:        ", r.swarm);

            // 5. ERC-8004 Registry Adapter
            r.registryAdapter = address(new SoulVaultERC8004RegistryAdapter());
            console.log("  [5/6] ERC8004RegistryAdapter:", r.registryAdapter);

            // 6. EIP-8004 Integration
            r.eip8004 = address(new EIP8004Integration(
                r.registryAdapter,
                r.registryAdapter,
                r.registryAdapter,
                r.proofOfClaw
            ));
            console.log("  [6/6] EIP8004Integration:    ", r.eip8004);

            // Link verifier to EIP-8004
            ProofOfClawVerifier(r.proofOfClaw).setEIP8004Integration(r.eip8004);
            console.log("  Linked EIP-8004 integration to verifier");
        }

        vm.stopBroadcast();

        _printSummary(chainId, r, fullSuite);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _validateChain(uint256 chainId) internal pure {
        require(
            chainId == CHAIN_SEPOLIA ||
            chainId == CHAIN_MAINNET ||
            chainId == CHAIN_0G_TESTNET ||
            chainId == CHAIN_0G_MAINNET,
            "Unsupported chain. Use Sepolia, Mainnet, 0G Testnet, or 0G Mainnet."
        );
    }

    function _chainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == CHAIN_SEPOLIA) return "Ethereum Sepolia";
        if (chainId == CHAIN_MAINNET) return "Ethereum Mainnet";
        if (chainId == CHAIN_0G_TESTNET) return "0G Testnet (Galileo)";
        if (chainId == CHAIN_0G_MAINNET) return "0G Mainnet";
        return "Unknown";
    }

    function _isTestnet(uint256 chainId) internal pure returns (bool) {
        return chainId == CHAIN_SEPOLIA ||
               chainId == CHAIN_0G_TESTNET;
    }

    function _envBool(string memory key, bool defaultValue) internal view returns (bool) {
        try vm.envBool(key) returns (bool val) {
            return val;
        } catch {
            return defaultValue;
        }
    }

    function _printHeader(uint256 chainId) internal pure {
        console.log("");
        console.log("======================================================");
        console.log("  Proof of Claw Multi-Chain Deployment");
        console.log("======================================================");
        console.log("  Chain:   ", _chainName(chainId));
        console.log("  Chain ID:", chainId);
        console.log("  Testnet: ", _isTestnet(chainId) ? "yes" : unicode"NO \u2014 MAINNET DEPLOYMENT");
        console.log("------------------------------------------------------");
    }

    function _printSummary(uint256 chainId, DeployResult memory r, bool fullSuite) internal pure {
        console.log("");
        console.log("======================================================");
        console.log("  Deployment Complete");
        console.log("======================================================");
        console.log("  Chain:                ", _chainName(chainId));
        console.log("  Groth16Verifier:      ", r.groth16Verifier);
        console.log("  ProofOfClawVerifier:  ", r.proofOfClaw);
        if (fullSuite) {
            console.log("  ProofOfClawINFT:      ", r.inft);
            console.log("  SoulVaultSwarm:       ", r.swarm);
            console.log("  ERC8004Registry:      ", r.registryAdapter);
            console.log("  EIP8004Integration:   ", r.eip8004);
        }
        console.log("======================================================");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Update .env with deployed addresses");
        console.log("  2. Update clear-signing/proofofclaw.json with new addresses");
        console.log("  3. Verify: forge verify-contract <addr> <Name> --chain", chainId);
    }
}
