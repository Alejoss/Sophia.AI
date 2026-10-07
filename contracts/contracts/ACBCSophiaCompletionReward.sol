// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title ACBCSophia transferable completion reward
/// @author ACBCSophia Academia Blockchain
/// @notice Transferable ERC-721 minted as a reward for finishing a knowledge path.
/// @dev This is not the educational certificate. Certificates live in
/// `ACBCSophiaCredentialRegistry` and stay soulbound. Tokens here can be transferred.
/// The contract does not grade completion. A minter records a reward the application
/// already approved. An issuance id can be used only once, so a retry cannot mint twice.
contract ACBCSophiaCompletionReward is ERC721, AccessControl {
    /// @notice Mints rewards. Does not receive admin powers from the constructor.
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId = 1;
    mapping(bytes32 issuanceId => uint256 tokenId) private _tokenByIssuanceId;
    mapping(uint256 tokenId => string uri) private _tokenUris;

    error ZeroAddress();
    error EmptyValue();
    error IssuanceIdUsed(bytes32 issuanceId);

    /// @param admin Address that receives `DEFAULT_ADMIN_ROLE` only.
    constructor(address admin) ERC721("ACBC Completion Reward", "ACBC") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Mint one transferable reward to `recipient`.
    /// @dev `issuanceId` is the stable retry key, for example keccak256 of
    /// `sophia-acbc:reward:{uuid}`. The same key must not be reused for a certificate.
    function mint(address recipient, bytes32 issuanceId, string calldata uri)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (recipient == address(0)) revert ZeroAddress();
        if (bytes(uri).length == 0) revert EmptyValue();
        if (_tokenByIssuanceId[issuanceId] != 0) revert IssuanceIdUsed(issuanceId);

        tokenId = _nextTokenId++;
        _tokenByIssuanceId[issuanceId] = tokenId;
        _tokenUris[tokenId] = uri;
        _safeMint(recipient, tokenId);
    }

    /// @notice Token id for an issuance key, or 0 when that key has not been used.
    function tokenIdByIssuanceId(bytes32 issuanceId) external view returns (uint256) {
        return _tokenByIssuanceId[issuanceId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenUris[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
