// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IRailgunSmartWallet
 * @notice Minimal interface for interacting with RAILGUN's shielded transfer system
 * @dev RAILGUN allows users to shield ERC-20 tokens into a private pool and perform
 *      private transfers / cross-contract calls using ZK-SNARKs.
 *
 * Integration docs:  https://docs.railgun.org/developer-guide
 * Contracts:         https://github.com/Railgun-Community/engine
 *
 * This interface covers the subset needed for AutoPay privacy routing:
 *   1. Shield USDC into the RAILGUN pool (customer side)
 *   2. Unshield USDC from the pool to a recipient (merchant side)
 */
interface IRailgunSmartWallet {

    /// @notice Token data for shielding
    struct ShieldRequest {
        bytes32 preimage;        // Encrypted commitment preimage
        bytes32 ciphertext;      // Encrypted random value
        address token;           // ERC-20 token address
        uint256 amount;          // Amount to shield
    }

    /**
     * @notice Shield ERC-20 tokens into the RAILGUN private balance
     * @param requests Array of shield requests
     */
    function shield(ShieldRequest[] calldata requests) external;
}
