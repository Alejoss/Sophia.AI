// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC5192} from "./interfaces/IERC5192.sol";

/// @title ACBCSophia educational credential registry
/// @author ACBCSophia Academia Blockchain
/// @notice Non-upgradeable ERC-721 registry for knowledge-path completion credentials.
/// @dev
/// Trust boundaries
/// - This contract does not grade quizzes, check publication rights, or prove a
///   person's identity. A scoped issuer records a claim the application already approved.
/// - Digests are stored as declared. The contract does not fetch IPFS bytes or
///   recompute SHA-256. Verifiers hash the retrieved file themselves.
/// - SHA-256 digests are raw 32-byte values. They are not Keccak-256 and they are
///   not IPFS CIDs.
/// - Bitcoin entries are authorized assertions bound to a transcript digest. They
///   are not a Bitcoin bridge, SPV proof, or confirmation check.
/// - `issuedAt` is the chain timestamp of the mint. The credential artifact's
///   `issuedAt` string is committed only through `credentialDigest`.
/// - Permanently soulbound: minted tokens stay locked. There is no unlock or burn.
/// - Not upgradeable. A rule change is a new deployment. Old tokens do not migrate.
/// - Pause stops new registry writes and issuance. Revocation still works so a
///   credential can be invalidated during an incident. Views stay available.
///
/// Permissions
/// - `DEFAULT_ADMIN_ROLE`: grant and revoke roles, including scoped issuers.
///   May revoke any credential. Cannot register, assert Bitcoin evidence, mint,
///   or replace unless it also holds that role.
/// - `REGISTRAR_ROLE`: register immutable transcripts and knowledge-path versions.
/// - `EVIDENCE_ROLE`: append Bitcoin network/transaction assertions.
/// - `PAUSER_ROLE`: pause and unpause new writes and issuance.
/// - `issuerRole(knowledgePathId)`: mint, replace, and revoke credentials for
///   that knowledge path only. Revoking the role does not change tokens already issued.
///
/// Invariants
/// - A transcript digest and an achievement version are immutable once registered.
/// - Achievement versions for one knowledge path start at 1 and increase by 1.
/// - Bitcoin assertions are append-only. A later assertion does not delete an earlier one.
/// - An issuance id can be used only once.
/// - `mint` creates the first credential for a recipient and achievement version.
///   A later credential for that pair must be a `replace`, which links to the previous token.
/// - A recipient has at most one valid credential per achievement version.
/// - Replacement does not change the achievement version. A new knowledge-path
///   version is a different achievement and uses `mint`.
/// - Revocation and replacement leave the token and its artifact readable.
/// - Transfers, approvals, and burns revert.
contract ACBCSophiaCredentialRegistry is ERC721, AccessControl, Pausable, ReentrancyGuard, IERC5192 {
    /// @notice Registers immutable transcript records and knowledge-path achievement versions.
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    /// @notice Appends Bitcoin evidence. Does not register transcripts or mint credentials.
    bytes32 public constant EVIDENCE_ROLE = keccak256("EVIDENCE_ROLE");

    /// @notice Pauses and unpauses new registry writes and issuance.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum CredentialStatus {
        Unknown,
        Valid,
        Revoked,
        Replaced
    }

    struct TranscriptRecord {
        string uri;
        string formatVersion;
        uint64 registeredAt;
        bool exists;
    }

    struct AchievementVersion {
        bytes32 snapshotDigest;
        string uri;
        string knowledgePathId;
        uint64 version;
        uint64 registeredAt;
        bool exists;
    }

    struct BitcoinAssertion {
        string network;
        string txid;
        address assertedBy;
        uint64 assertedAt;
    }

    struct Credential {
        bytes32 issuanceId;
        bytes32 achievementKey;
        bytes32 credentialDigest;
        string credentialUri;
        address issuer;
        uint64 issuedAt;
        CredentialStatus status;
        uint256 replacedByTokenId;
        uint256 replacesTokenId;
        address revokedBy;
        uint64 revokedAt;
    }

    /// @notice Exact archived transcript bytes identified by their SHA-256 digest.
    event TranscriptRegistered(bytes32 indexed digest, string uri, string formatVersion);

    /// @notice Immutable knowledge-path snapshot registered as an achievement version.
    event AchievementVersionRegistered(
        bytes32 indexed achievementKey,
        uint64 indexed version,
        bytes32 indexed snapshotDigest,
        string knowledgePathId,
        string uri
    );

    /// @notice Append-only Bitcoin reference for an already registered transcript digest.
    event BitcoinEvidenceAsserted(
        bytes32 indexed transcriptDigest,
        address indexed assertedBy,
        string network,
        string txid
    );

    /// @notice Emitted when a credential record is stored. The ERC-721 mint follows in the same transaction.
    event CredentialIssued(
        uint256 indexed tokenId,
        bytes32 indexed issuanceId,
        address indexed recipient,
        bytes32 achievementKey,
        bytes32 credentialDigest,
        string credentialUri,
        address issuer
    );

    /// @notice Validity was withdrawn. The token and artifact remain readable.
    event CredentialRevoked(uint256 indexed tokenId, address indexed revokedBy);

    /// @notice `successorTokenId` replaces `originalTokenId`. The successor has its own issuance id.
    event CredentialReplaced(
        uint256 indexed originalTokenId,
        uint256 indexed successorTokenId,
        bytes32 indexed successorIssuanceId
    );

    error ZeroAddress();
    error ZeroDigest();
    error EmptyValue();
    error TranscriptAlreadyRegistered(bytes32 digest);
    error TranscriptNotRegistered(bytes32 digest);
    error AchievementVersionAlreadyRegistered(bytes32 achievementKey);
    error AchievementVersionNotRegistered(bytes32 achievementKey);
    error VersionNotMonotone(uint64 expected, uint64 provided);
    error SnapshotDigestMismatch(bytes32 declared, bytes32 registered);
    error DuplicateBitcoinEvidence(bytes32 transcriptDigest, string txid);
    error IssuanceIdUsed(bytes32 issuanceId);
    error CredentialAlreadyIssued(address recipient, bytes32 achievementKey);
    error CredentialNotFound(uint256 tokenId);
    error CredentialNotRevocable(uint256 tokenId);
    error SuccessorAlreadyExists(uint256 tokenId);
    error TransferLocked(uint256 tokenId);
    error ApprovalsDisabled();
    error EvidenceIndexOutOfBounds(uint256 index, uint256 length);

    mapping(bytes32 digest => TranscriptRecord record) private _transcripts;
    mapping(bytes32 achievementKey => AchievementVersion record) private _achievements;
    mapping(bytes32 pathKey => uint64 latestVersion) private _latestVersion;
    mapping(bytes32 transcriptDigest => BitcoinAssertion[] assertions) private _bitcoinEvidence;
    mapping(bytes32 assertionKey => bool seen) private _bitcoinAssertionSeen;

    mapping(uint256 tokenId => Credential credential) private _credentials;
    mapping(bytes32 issuanceId => uint256 tokenId) private _tokenByIssuanceId;
    /// @dev Latest token id recorded for a recipient and achievement, including revoked or replaced.
    mapping(bytes32 holderKey => uint256 tokenId) private _latestToken;
    uint256 private _nextTokenId = 1;

    /// @param admin Address that receives `DEFAULT_ADMIN_ROLE`. It does not receive registrar, evidence, pauser, or issuer roles.
    constructor(address admin) ERC721("ACBC Educational Credential", "ACBC") {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Role id for issuers of one knowledge path, such as `sophia-acbc:knowledge-path:42`.
    function issuerRole(string memory knowledgePathId) public pure returns (bytes32) {
        return keccak256(abi.encode("SOPHIA_ISSUER_ROLE", knowledgePathId));
    }

    /// @notice Key for a knowledge-path id and monotone version. Versions of different paths do not share a sequence.
    function achievementKey(string memory knowledgePathId, uint64 version) public pure returns (bytes32) {
        return keccak256(abi.encode(knowledgePathId, version));
    }

    /// @notice Grant mint, replace, and revoke rights for one knowledge path.
    function grantIssuer(string calldata knowledgePathId, address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (account == address(0)) revert ZeroAddress();
        _requireNonEmpty(knowledgePathId);
        _grantRole(issuerRole(knowledgePathId), account);
    }

    /// @notice Remove future issuance rights for one knowledge path. Existing tokens stay as they are.
    function revokeIssuer(string calldata knowledgePathId, address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(issuerRole(knowledgePathId), account);
    }

    function isIssuer(string calldata knowledgePathId, address account) external view returns (bool) {
        return hasRole(issuerRole(knowledgePathId), account);
    }

    /// @notice Stop new registrations, Bitcoin assertions, mints, and replacements.
    /// @dev Does not block `revoke` or view functions.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resume registrations, Bitcoin assertions, mints, and replacements.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /// @notice Register the SHA-256 digest of exact normalized transcript bytes.
    /// @param digest SHA-256 of the archived transcript text. Not Keccak-256.
    /// @param uri Address of those exact bytes (for example an IPFS URI).
    /// @param formatVersion Normalization label, expected `sophia-acbc-normalized-transcript-v1`.
    function registerTranscript(bytes32 digest, string calldata uri, string calldata formatVersion)
        external
        onlyRole(REGISTRAR_ROLE)
        whenNotPaused
    {
        if (digest == bytes32(0)) revert ZeroDigest();
        _requireNonEmpty(uri);
        _requireNonEmpty(formatVersion);
        if (_transcripts[digest].exists) revert TranscriptAlreadyRegistered(digest);

        _transcripts[digest] = TranscriptRecord({
            uri: uri,
            formatVersion: formatVersion,
            registeredAt: uint64(block.timestamp),
            exists: true
        });
        emit TranscriptRegistered(digest, uri, formatVersion);
    }

    /// @notice Register the next immutable knowledge-path snapshot version.
    /// @dev `version` must be 1 for a new path and exactly one greater than the latest version after that.
    /// The snapshot digest is not checked against IPFS. `uri` must address the same canonical bytes the digest commits to.
    function registerAchievementVersion(
        string calldata knowledgePathId,
        uint64 version,
        bytes32 snapshotDigest,
        string calldata uri
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused {
        _requireNonEmpty(knowledgePathId);
        if (snapshotDigest == bytes32(0)) revert ZeroDigest();
        _requireNonEmpty(uri);

        bytes32 key = achievementKey(knowledgePathId, version);
        if (_achievements[key].exists) revert AchievementVersionAlreadyRegistered(key);

        uint64 expected = _latestVersion[_pathKey(knowledgePathId)] + 1;
        if (version != expected) revert VersionNotMonotone(expected, version);

        _achievements[key] = AchievementVersion({
            snapshotDigest: snapshotDigest,
            uri: uri,
            knowledgePathId: knowledgePathId,
            version: version,
            registeredAt: uint64(block.timestamp),
            exists: true
        });
        _latestVersion[_pathKey(knowledgePathId)] = version;
        emit AchievementVersionRegistered(key, version, snapshotDigest, knowledgePathId, uri);
    }

    /// @notice Append a Bitcoin transaction reference for a registered transcript digest.
    /// @dev Does not remove or replace earlier assertions. The contract does not verify the transaction.
    /// @param network Network label stored exactly as provided, such as the platform `btc_network` value.
    /// @param txid Platform `btc_txid` string, stored exactly as provided.
    function assertBitcoinEvidence(bytes32 transcriptDigest, string calldata network, string calldata txid)
        external
        onlyRole(EVIDENCE_ROLE)
        whenNotPaused
    {
        if (!_transcripts[transcriptDigest].exists) revert TranscriptNotRegistered(transcriptDigest);
        _requireNonEmpty(network);
        _requireNonEmpty(txid);

        bytes32 seenKey = keccak256(abi.encode(transcriptDigest, network, txid));
        if (_bitcoinAssertionSeen[seenKey]) revert DuplicateBitcoinEvidence(transcriptDigest, txid);
        _bitcoinAssertionSeen[seenKey] = true;

        _bitcoinEvidence[transcriptDigest].push(
            BitcoinAssertion({
                network: network,
                txid: txid,
                assertedBy: _msgSender(),
                assertedAt: uint64(block.timestamp)
            })
        );
        emit BitcoinEvidenceAsserted(transcriptDigest, _msgSender(), network, txid);
    }

    /// @notice Mint the first soulbound credential for `recipient` and one registered achievement version.
    /// @dev Caller must hold `issuerRole(knowledgePathId)`. `expectedSnapshotDigest` must equal the registered digest.
    /// `issuanceId` is the stable retry key (for example keccak256 of `sophia-acbc:credential:{uuid}`).
    /// A second credential for the same recipient and version must use `replace`.
    function mint(
        address recipient,
        bytes32 issuanceId,
        string calldata knowledgePathId,
        uint64 version,
        bytes32 expectedSnapshotDigest,
        bytes32 credentialDigest,
        string calldata credentialUri
    ) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        _checkRole(issuerRole(knowledgePathId));
        bytes32 key = achievementKey(knowledgePathId, version);
        AchievementVersion storage achievement = _achievements[key];
        if (!achievement.exists) revert AchievementVersionNotRegistered(key);
        if (achievement.snapshotDigest != expectedSnapshotDigest) {
            revert SnapshotDigestMismatch(expectedSnapshotDigest, achievement.snapshotDigest);
        }
        if (_latestToken[_holderKey(recipient, key)] != 0) {
            revert CredentialAlreadyIssued(recipient, key);
        }

        tokenId = _storeCredential(recipient, issuanceId, key, credentialDigest, credentialUri, 0);
        _safeMint(recipient, tokenId);
    }

    /// @notice Mint a successor credential linked to `originalTokenId`.
    /// @dev Uses the original achievement version. `recipient` may be the same wallet or a recovered one.
    /// A valid original becomes `Replaced`. A revoked original stays `Revoked` and gains `replacedByTokenId`.
    /// The successor needs a new `issuanceId`.
    function replace(
        uint256 originalTokenId,
        address recipient,
        bytes32 issuanceId,
        bytes32 credentialDigest,
        string calldata credentialUri
    ) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        bytes32 key = _requireReplacementAllowed(originalTokenId, recipient);
        tokenId = _storeCredential(recipient, issuanceId, key, credentialDigest, credentialUri, originalTokenId);
        _finishReplacement(originalTokenId, tokenId, issuanceId);
        _safeMint(recipient, tokenId);
    }

    /// @notice Mark a valid credential invalid. The token, owner, and artifact URI stay readable.
    /// @dev Allowed while paused. Caller must be a scoped issuer for that knowledge path or `DEFAULT_ADMIN_ROLE`.
    /// Revocation is not reversible. A successor, if one is issued later, must go through `replace`.
    function revoke(uint256 tokenId) external nonReentrant {
        Credential storage credential = _credentials[tokenId];
        if (credential.status == CredentialStatus.Unknown) revert CredentialNotFound(tokenId);
        if (credential.status != CredentialStatus.Valid) revert CredentialNotRevocable(tokenId);

        bytes32 role = issuerRole(_achievements[credential.achievementKey].knowledgePathId);
        if (!hasRole(DEFAULT_ADMIN_ROLE, _msgSender())) {
            _checkRole(role);
        }

        credential.status = CredentialStatus.Revoked;
        credential.revokedBy = _msgSender();
        credential.revokedAt = uint64(block.timestamp);
        emit CredentialRevoked(tokenId, _msgSender());
    }

    function transcriptExists(bytes32 digest) external view returns (bool) {
        return _transcripts[digest].exists;
    }

    function getTranscript(bytes32 digest)
        external
        view
        returns (string memory uri, string memory formatVersion, uint64 registeredAt)
    {
        TranscriptRecord storage record = _transcripts[digest];
        if (!record.exists) revert TranscriptNotRegistered(digest);
        return (record.uri, record.formatVersion, record.registeredAt);
    }

    function achievementExists(string calldata knowledgePathId, uint64 version) external view returns (bool) {
        return _achievements[achievementKey(knowledgePathId, version)].exists;
    }

    /// @notice Highest registered version for a knowledge path, or 0 when none exists.
    function latestAchievementVersion(string calldata knowledgePathId) external view returns (uint64) {
        return _latestVersion[_pathKey(knowledgePathId)];
    }

    function getAchievementVersion(string calldata knowledgePathId, uint64 version)
        external
        view
        returns (bytes32 snapshotDigest, string memory uri, string memory storedKnowledgePathId, uint64 registeredAt)
    {
        AchievementVersion storage record = _achievements[achievementKey(knowledgePathId, version)];
        if (!record.exists) revert AchievementVersionNotRegistered(achievementKey(knowledgePathId, version));
        return (record.snapshotDigest, record.uri, record.knowledgePathId, record.registeredAt);
    }

    function bitcoinEvidenceCount(bytes32 transcriptDigest) external view returns (uint256) {
        return _bitcoinEvidence[transcriptDigest].length;
    }

    /// @notice Read one append-only Bitcoin assertion. Index 0 is the earliest.
    function bitcoinEvidenceAt(bytes32 transcriptDigest, uint256 index)
        external
        view
        returns (string memory network, string memory txid, address assertedBy, uint64 assertedAt)
    {
        BitcoinAssertion[] storage assertions = _bitcoinEvidence[transcriptDigest];
        if (index >= assertions.length) revert EvidenceIndexOutOfBounds(index, assertions.length);
        BitcoinAssertion storage assertion = assertions[index];
        return (assertion.network, assertion.txid, assertion.assertedBy, assertion.assertedAt);
    }

    /// @notice Token id for an issuance key, or 0 when that key has not been used.
    function tokenIdByIssuanceId(bytes32 issuanceId) external view returns (uint256) {
        return _tokenByIssuanceId[issuanceId];
    }

    /// @notice Latest token recorded for this recipient and achievement, even if revoked or replaced.
    /// @dev Returns 0 when the recipient has no credential for that version.
    function latestToken(address recipient, string calldata knowledgePathId, uint64 version)
        external
        view
        returns (uint256)
    {
        return _latestToken[_holderKey(recipient, achievementKey(knowledgePathId, version))];
    }

    /// @notice Current valid token for this recipient and achievement, or 0 when none is valid.
    function activeToken(address recipient, string calldata knowledgePathId, uint64 version)
        external
        view
        returns (uint256)
    {
        uint256 tokenId = _latestToken[_holderKey(recipient, achievementKey(knowledgePathId, version))];
        if (tokenId == 0 || _credentials[tokenId].status != CredentialStatus.Valid) return 0;
        return tokenId;
    }

    /// @notice False when the credential is revoked or replaced. Reverts if `tokenId` was never minted.
    function isValid(uint256 tokenId) external view returns (bool) {
        CredentialStatus status = _credentials[tokenId].status;
        if (status == CredentialStatus.Unknown) revert CredentialNotFound(tokenId);
        return status == CredentialStatus.Valid;
    }

    function getCredential(uint256 tokenId)
        external
        view
        returns (
            bytes32 issuanceId,
            bytes32 achievementKey_,
            bytes32 credentialDigest,
            string memory credentialUri,
            address issuer,
            uint64 issuedAt,
            CredentialStatus status,
            uint256 replacedByTokenId,
            uint256 replacesTokenId,
            address revokedBy,
            uint64 revokedAt
        )
    {
        Credential storage credential = _credentials[tokenId];
        if (credential.status == CredentialStatus.Unknown) revert CredentialNotFound(tokenId);
        return (
            credential.issuanceId,
            credential.achievementKey,
            credential.credentialDigest,
            credential.credentialUri,
            credential.issuer,
            credential.issuedAt,
            credential.status,
            credential.replacedByTokenId,
            credential.replacesTokenId,
            credential.revokedBy,
            credential.revokedAt
        );
    }

    /// @inheritdoc IERC5192
    /// @dev Always true for a minted credential. There is no unlock path.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _credentials[tokenId].credentialUri;
    }

    function approve(address, uint256) public pure override {
        revert ApprovalsDisabled();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert ApprovalsDisabled();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @dev Blocks every transfer and burn of an existing token. Mints emit `Locked`.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (_ownerOf(tokenId) != address(0)) revert TransferLocked(tokenId);
        address previous = super._update(to, tokenId, auth);
        if (to != address(0)) emit Locked(tokenId);
        return previous;
    }

    function _storeCredential(
        address recipient,
        bytes32 issuanceId,
        bytes32 achievementKey_,
        bytes32 credentialDigest,
        string calldata credentialUri,
        uint256 replacesTokenId
    ) internal returns (uint256 tokenId) {
        if (recipient == address(0)) revert ZeroAddress();
        if (issuanceId == bytes32(0) || credentialDigest == bytes32(0)) revert ZeroDigest();
        _requireNonEmpty(credentialUri);
        if (_tokenByIssuanceId[issuanceId] != 0) revert IssuanceIdUsed(issuanceId);

        tokenId = _nextTokenId++;
        _tokenByIssuanceId[issuanceId] = tokenId;
        _latestToken[_holderKey(recipient, achievementKey_)] = tokenId;
        _credentials[tokenId] = Credential({
            issuanceId: issuanceId,
            achievementKey: achievementKey_,
            credentialDigest: credentialDigest,
            credentialUri: credentialUri,
            issuer: _msgSender(),
            issuedAt: uint64(block.timestamp),
            status: CredentialStatus.Valid,
            replacedByTokenId: 0,
            replacesTokenId: replacesTokenId,
            revokedBy: address(0),
            revokedAt: 0
        });
        emit CredentialIssued(
            tokenId,
            issuanceId,
            recipient,
            achievementKey_,
            credentialDigest,
            credentialUri,
            _msgSender()
        );
    }

    /// @dev Checks and role lookup live here so `replace` does not exceed Solidity's stack limit.
    function _requireReplacementAllowed(uint256 originalTokenId, address recipient) internal view returns (bytes32 key) {
        Credential storage original = _credentials[originalTokenId];
        if (original.status == CredentialStatus.Unknown) revert CredentialNotFound(originalTokenId);
        if (original.replacedByTokenId != 0 || original.status == CredentialStatus.Replaced) {
            revert SuccessorAlreadyExists(originalTokenId);
        }

        key = original.achievementKey;
        _checkRole(issuerRole(_achievements[key].knowledgePathId));

        uint256 existing = _latestToken[_holderKey(recipient, key)];
        if (existing != 0 && existing != originalTokenId && _credentials[existing].status == CredentialStatus.Valid) {
            revert CredentialAlreadyIssued(recipient, key);
        }
    }

    function _finishReplacement(uint256 originalTokenId, uint256 successorTokenId, bytes32 issuanceId) internal {
        Credential storage original = _credentials[originalTokenId];
        original.replacedByTokenId = successorTokenId;
        if (original.status == CredentialStatus.Valid) {
            original.status = CredentialStatus.Replaced;
        }
        emit CredentialReplaced(originalTokenId, successorTokenId, issuanceId);
    }

    function _holderKey(address recipient, bytes32 achievementKey_) internal pure returns (bytes32) {
        return keccak256(abi.encode(recipient, achievementKey_));
    }

    function _pathKey(string memory knowledgePathId) internal pure returns (bytes32) {
        return keccak256(abi.encode(knowledgePathId));
    }

    function _requireNonEmpty(string calldata value) internal pure {
        if (bytes(value).length == 0) revert EmptyValue();
    }
}
