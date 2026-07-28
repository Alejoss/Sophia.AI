// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TranscriptAnchorRegistry
 * @notice On-chain index for transcript certifications.
 * @dev Bitcoin OP_RETURN holds the text hash (existence proof). This contract
 *      stores the same hash plus optional IPFS CID and Bitcoin txid so the app
 *      can discover and display anchors. It does not verify Bitcoin inclusion.
 */
contract TranscriptAnchorRegistry is Ownable {
    struct Anchor {
        bytes32 textHash;
        bytes32 btcTxId;
        string ipfsCid;
        address recordedBy;
        uint64 recordedAt;
        bool exists;
    }

    mapping(bytes32 => Anchor) private anchorsByHash;
    mapping(bytes32 => bytes32) private hashByBtcTxId;

    event TranscriptAnchored(
        bytes32 indexed textHash,
        bytes32 indexed btcTxId,
        address indexed recordedBy,
        string ipfsCid,
        uint64 recordedAt
    );

    event IpfsCidUpdated(bytes32 indexed textHash, string ipfsCid);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Record a transcript hash already (or about to be) anchored on Bitcoin.
     * @param textHash SHA-256 digest of the normalized transcript plain text.
     * @param btcTxId Bitcoin transaction id (32 bytes). Use bytes32(0) if not yet known.
     * @param ipfsCid Optional IPFS CID for the certified text (empty string allowed).
     */
    function storeAnchor(
        bytes32 textHash,
        bytes32 btcTxId,
        string calldata ipfsCid
    ) external {
        require(textHash != bytes32(0), "Empty text hash");
        require(!anchorsByHash[textHash].exists, "Hash already stored");
        if (btcTxId != bytes32(0)) {
            require(hashByBtcTxId[btcTxId] == bytes32(0), "BTC tx already linked");
        }

        uint64 recordedAt = uint64(block.timestamp);
        anchorsByHash[textHash] = Anchor({
            textHash: textHash,
            btcTxId: btcTxId,
            ipfsCid: ipfsCid,
            recordedBy: msg.sender,
            recordedAt: recordedAt,
            exists: true
        });
        if (btcTxId != bytes32(0)) {
            hashByBtcTxId[btcTxId] = textHash;
        }

        emit TranscriptAnchored(textHash, btcTxId, msg.sender, ipfsCid, recordedAt);
    }

    /**
     * @notice Attach or replace the Bitcoin txid once the OP_RETURN tx confirms.
     */
    function setBtcTxId(bytes32 textHash, bytes32 btcTxId) external {
        Anchor storage anchor = anchorsByHash[textHash];
        require(anchor.exists, "Hash not stored");
        require(
            msg.sender == anchor.recordedBy || msg.sender == owner(),
            "Not authorized"
        );
        require(btcTxId != bytes32(0), "Empty BTC tx");
        require(hashByBtcTxId[btcTxId] == bytes32(0), "BTC tx already linked");

        if (anchor.btcTxId != bytes32(0)) {
            delete hashByBtcTxId[anchor.btcTxId];
        }
        anchor.btcTxId = btcTxId;
        hashByBtcTxId[btcTxId] = textHash;

        emit TranscriptAnchored(
            textHash,
            btcTxId,
            msg.sender,
            anchor.ipfsCid,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Attach or update the IPFS CID for an existing anchor.
     */
    function setIpfsCid(bytes32 textHash, string calldata ipfsCid) external {
        Anchor storage anchor = anchorsByHash[textHash];
        require(anchor.exists, "Hash not stored");
        require(
            msg.sender == anchor.recordedBy || msg.sender == owner(),
            "Not authorized"
        );
        anchor.ipfsCid = ipfsCid;
        emit IpfsCidUpdated(textHash, ipfsCid);
    }

    function getAnchor(bytes32 textHash) external view returns (Anchor memory) {
        require(anchorsByHash[textHash].exists, "Hash not stored");
        return anchorsByHash[textHash];
    }

    function isHashStored(bytes32 textHash) external view returns (bool) {
        return anchorsByHash[textHash].exists;
    }

    function getHashByBtcTxId(bytes32 btcTxId) external view returns (bytes32) {
        return hashByBtcTxId[btcTxId];
    }
}
