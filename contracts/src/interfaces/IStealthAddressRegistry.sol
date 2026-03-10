// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IStealthAddressRegistry
 * @notice Interface compatible with ERC-5564 / ERC-6538 stealth address registries (e.g. Umbra)
 * @dev Merchants register stealth meta-addresses. Payers generate one-time stealth addresses
 *      per subscription so that on-chain observers cannot link payments to the merchant's
 *      real address.
 *
 * Third-party implementations:
 *   - Umbra (ScopeLift):  https://github.com/ScopeLift/umbra-protocol
 *   - ERC-6538 Registry:  https://eips.ethereum.org/EIPS/eip-6538
 */
interface IStealthAddressRegistry {

    /// @notice Emitted when a merchant registers or updates their stealth meta-address
    event StealthMetaAddressRegistered(
        address indexed merchant,
        uint256 spendingPubKeyX,
        uint256 spendingPubKeyY,
        uint256 viewingPubKeyX,
        uint256 viewingPubKeyY
    );

    /**
     * @notice Register a stealth meta-address (spending + viewing public keys)
     * @param spendingPubKeyX X-coordinate of secp256k1 spending public key
     * @param spendingPubKeyY Y-coordinate of secp256k1 spending public key
     * @param viewingPubKeyX  X-coordinate of secp256k1 viewing public key
     * @param viewingPubKeyY  Y-coordinate of secp256k1 viewing public key
     */
    function registerKeys(
        uint256 spendingPubKeyX,
        uint256 spendingPubKeyY,
        uint256 viewingPubKeyX,
        uint256 viewingPubKeyY
    ) external;

    /**
     * @notice Look up the stealth meta-address for a given registrant
     * @param registrant The address whose keys to retrieve
     * @return spendingPubKeyX X-coordinate of spending public key
     * @return spendingPubKeyY Y-coordinate of spending public key
     * @return viewingPubKeyX  X-coordinate of viewing public key
     * @return viewingPubKeyY  Y-coordinate of viewing public key
     */
    function stealthKeys(address registrant) external view returns (
        uint256 spendingPubKeyX,
        uint256 spendingPubKeyY,
        uint256 viewingPubKeyX,
        uint256 viewingPubKeyY
    );
}
