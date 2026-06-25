// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IRiscZeroVerifier.sol";

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  WARNING: TEST-ONLY CONTRACT — DO NOT DEPLOY TO MAINNET                ║
// ║                                                                        ║
// ║  This mock verifier accepts ALL proofs without validation.             ║
// ║  It is intended exclusively for local testing (Anvil/Hardhat) and      ║
// ║  testnet deployments (Sepolia, 0G Galileo).                            ║
// ║                                                                        ║
// ║  The constructor will revert on Ethereum Mainnet (chain ID 1)          ║
// ║  and 0G Mainnet (chain ID 16605) to prevent accidental deployment.     ║
// ║                                                                        ║
// ║  For production, use RiscZeroGroth16Verifier with real ZK proofs.      ║
// ╚══════════════════════════════════════════════════════════════════════════╝

/// @title RiscZeroMockVerifier — Testnet-only mock for RISC Zero proof verification
/// @notice Always accepts proofs. Reverts on mainnet chain IDs at deploy time.
/// @dev DO NOT use in production. Constructor blocks deployment on mainnet chains.
contract RiscZeroMockVerifier is IRiscZeroVerifier {
    /// @dev Allowed chain IDs: Anvil/Hardhat (31337), Sepolia (11155111), 0G Testnet (16602)
    uint256 private constant CHAIN_MAINNET    = 1;
    uint256 private constant CHAIN_0G_MAINNET = 16605;

    error MockVerifierBlockedOnMainnet(uint256 chainId);

    /// @notice Reverts if deployed on a known mainnet chain ID.
    constructor() {
        uint256 chainId = block.chainid;
        if (chainId == CHAIN_MAINNET || chainId == CHAIN_0G_MAINNET) {
            revert MockVerifierBlockedOnMainnet(chainId);
        }
    }

    /// @notice Mock verify — always succeeds (no-op).
    function verify(
        bytes calldata,
        bytes32,
        bytes32
    ) external pure override {
        // Accept all proofs on testnet
    }
}
