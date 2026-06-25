// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IRiscZeroVerifier {
    function verify(
        bytes calldata seal,
        bytes32 imageId,
        bytes32 journalHash
    ) external view;
}
