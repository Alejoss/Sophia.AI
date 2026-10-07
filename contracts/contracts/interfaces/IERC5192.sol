// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ERC-5192 Minimal Soulbound NFTs
/// @notice https://eips.ethereum.org/EIPS/eip-5192
interface IERC5192 {
    /// @notice Emitted when `tokenId` is locked against transfers.
    event Locked(uint256 tokenId);

    /// @notice Emitted when `tokenId` is unlocked.
    /// @dev ACBCSophia credentials are permanently locked. This event is required by
    /// ERC-5192 and is not emitted by ACBCSophiaCredentialRegistry.
    event Unlocked(uint256 tokenId);

    /// @notice Returns the locking status of `tokenId`.
    /// @dev Reverts if `tokenId` has not been minted.
    function locked(uint256 tokenId) external view returns (bool);
}
