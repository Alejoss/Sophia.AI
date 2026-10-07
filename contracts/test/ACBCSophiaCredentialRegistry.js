const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const PATH_A = "sophia-acbc:knowledge-path:42";
const PATH_B = "sophia-acbc:knowledge-path:7";
const SNAPSHOT_V1 = "0xf0400aa934c57e35f448b5c2499012dd8b7ac611161c801b631004e7b8649117";
const SNAPSHOT_V2 = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CREDENTIAL_DIGEST = "0x84ab53c38e4c64b73b8bb3976f6203dbef34f4be37f8afb8f789506cba5af416";
const CREDENTIAL_DIGEST_2 = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TRANSCRIPT_DIGEST = "0x339031cab719a48f31d973d073c0e54bdf9ea38ee91f51a297b0a77532857d76";
const FORMAT = "sophia-acbc-normalized-transcript-v1";
const TRANSCRIPT_URI = "ipfs://bafybeiexampletranscript";
const SNAPSHOT_URI = "ipfs://bafybeiexamplesnapshot";
const SNAPSHOT_URI_V2 = "ipfs://bafybeiexamplesnapshotv2";
const CREDENTIAL_URI = "ipfs://bafybeiexamplecredential";
const CREDENTIAL_URI_2 = "ipfs://bafybeiexamplecredential2";
const TXID_1 = "4f1c0b0f0c0d0e0f101112131415161718191a1b1c1d1e1f2021222324252627";
const TXID_2 = "5a2d1c1e1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738";
const NETWORK = "bitcoin-signet";

const Status = { Unknown: 0n, Valid: 1n, Revoked: 2n, Replaced: 3n };

function issuanceId(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

async function deployRegistry() {
  const [admin, registrar, evidence, pauser, issuer, otherIssuer, learner, otherLearner, recovered, stranger] =
    await ethers.getSigners();

  const factory = await ethers.getContractFactory("ACBCSophiaCredentialRegistry");
  const registry = await factory.deploy(admin.address);

  await registry.grantRole(await registry.REGISTRAR_ROLE(), registrar.address);
  await registry.grantRole(await registry.EVIDENCE_ROLE(), evidence.address);
  await registry.grantRole(await registry.PAUSER_ROLE(), pauser.address);
  await registry.grantIssuer(PATH_A, issuer.address);

  return {
    registry,
    admin,
    registrar,
    evidence,
    pauser,
    issuer,
    otherIssuer,
    learner,
    otherLearner,
    recovered,
    stranger,
  };
}

async function registerPathVersion(registry, registrar, path, version, digest, uri) {
  await registry.connect(registrar).registerAchievementVersion(path, version, digest, uri);
}

async function mintCredential(registry, issuer, learner, path, version, snapshotDigest, label) {
  const id = issuanceId(label);
  await registry
    .connect(issuer)
    .mint(learner.address, id, path, version, snapshotDigest, CREDENTIAL_DIGEST, CREDENTIAL_URI);
  return registry.tokenIdByIssuanceId(id);
}

describe("ACBCSophiaCredentialRegistry", function () {
  describe("permissions", function () {
    it("gives the admin no registrar, evidence, pauser, or issuer role", async function () {
      const { registry, admin } = await loadFixture(deployRegistry);
      expect(await registry.hasRole(await registry.REGISTRAR_ROLE(), admin.address)).to.equal(false);
      expect(await registry.hasRole(await registry.EVIDENCE_ROLE(), admin.address)).to.equal(false);
      expect(await registry.hasRole(await registry.PAUSER_ROLE(), admin.address)).to.equal(false);
      expect(await registry.isIssuer(PATH_A, admin.address)).to.equal(false);
    });

    it("rejects a zero admin", async function () {
      const factory = await ethers.getContractFactory("ACBCSophiaCredentialRegistry");
      await expect(factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("lets only the admin grant and revoke a scoped issuer", async function () {
      const { registry, admin, issuer, otherIssuer, stranger } = await loadFixture(deployRegistry);

      await expect(registry.connect(stranger).grantIssuer(PATH_B, otherIssuer.address)).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount",
      );
      await expect(registry.connect(issuer).grantIssuer(PATH_B, otherIssuer.address)).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount",
      );

      await registry.connect(admin).grantIssuer(PATH_B, otherIssuer.address);
      expect(await registry.isIssuer(PATH_B, otherIssuer.address)).to.equal(true);
      expect(await registry.isIssuer(PATH_A, otherIssuer.address)).to.equal(false);

      await registry.connect(admin).revokeIssuer(PATH_B, otherIssuer.address);
      expect(await registry.isIssuer(PATH_B, otherIssuer.address)).to.equal(false);
    });

    it("rejects unauthorized registration, evidence, mint, and pause", async function () {
      const { registry, stranger, learner } = await loadFixture(deployRegistry);

      await expect(
        registry.connect(stranger).registerTranscript(TRANSCRIPT_DIGEST, TRANSCRIPT_URI, FORMAT),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(
        registry.connect(stranger).registerAchievementVersion(PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(
        registry.connect(stranger).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_1),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(
        registry
          .connect(stranger)
          .mint(
            learner.address,
            issuanceId("unauth"),
            PATH_A,
            1,
            SNAPSHOT_V1,
            CREDENTIAL_DIGEST,
            CREDENTIAL_URI,
          ),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.connect(stranger).pause()).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("transcripts and achievement versions", function () {
    it("registers an immutable transcript and rejects a second write", async function () {
      const { registry, registrar, evidence } = await loadFixture(deployRegistry);

      await expect(registry.connect(evidence).registerTranscript(TRANSCRIPT_DIGEST, TRANSCRIPT_URI, FORMAT))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

      await expect(registry.connect(registrar).registerTranscript(TRANSCRIPT_DIGEST, TRANSCRIPT_URI, FORMAT))
        .to.emit(registry, "TranscriptRegistered")
        .withArgs(TRANSCRIPT_DIGEST, TRANSCRIPT_URI, FORMAT);

      const stored = await registry.getTranscript(TRANSCRIPT_DIGEST);
      expect(stored.uri).to.equal(TRANSCRIPT_URI);
      expect(stored.formatVersion).to.equal(FORMAT);

      await expect(
        registry.connect(registrar).registerTranscript(TRANSCRIPT_DIGEST, "ipfs://other", FORMAT),
      ).to.be.revertedWithCustomError(registry, "TranscriptAlreadyRegistered");
      await expect(
        registry.connect(registrar).registerTranscript(ethers.ZeroHash, TRANSCRIPT_URI, FORMAT),
      ).to.be.revertedWithCustomError(registry, "ZeroDigest");
      await expect(
        registry.connect(registrar).registerTranscript(TRANSCRIPT_DIGEST, "", FORMAT),
      ).to.be.revertedWithCustomError(registry, "EmptyValue");
    });

    it("requires monotone versions and refuses to rewrite a registered version", async function () {
      const { registry, registrar } = await loadFixture(deployRegistry);

      await expect(registry.connect(registrar).registerAchievementVersion(PATH_A, 0, SNAPSHOT_V1, SNAPSHOT_URI))
        .to.be.revertedWithCustomError(registry, "VersionNotMonotone")
        .withArgs(1, 0);
      await expect(registry.connect(registrar).registerAchievementVersion(PATH_A, 2, SNAPSHOT_V1, SNAPSHOT_URI))
        .to.be.revertedWithCustomError(registry, "VersionNotMonotone")
        .withArgs(1, 2);

      await expect(registry.connect(registrar).registerAchievementVersion(PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI))
        .to.emit(registry, "AchievementVersionRegistered");

      expect(await registry.latestAchievementVersion(PATH_A)).to.equal(1);
      const stored = await registry.getAchievementVersion(PATH_A, 1);
      expect(stored.snapshotDigest).to.equal(SNAPSHOT_V1);
      expect(stored.uri).to.equal(SNAPSHOT_URI);
      expect(stored.storedKnowledgePathId).to.equal(PATH_A);

      await expect(
        registry.connect(registrar).registerAchievementVersion(PATH_A, 1, SNAPSHOT_V2, SNAPSHOT_URI_V2),
      ).to.be.revertedWithCustomError(registry, "AchievementVersionAlreadyRegistered");

      await registry.connect(registrar).registerAchievementVersion(PATH_A, 2, SNAPSHOT_V2, SNAPSHOT_URI_V2);
      expect(await registry.latestAchievementVersion(PATH_A)).to.equal(2);
      expect((await registry.getAchievementVersion(PATH_A, 1)).snapshotDigest).to.equal(SNAPSHOT_V1);

      await registry.connect(registrar).registerAchievementVersion(PATH_B, 1, SNAPSHOT_V1, SNAPSHOT_URI);
      expect(await registry.latestAchievementVersion(PATH_B)).to.equal(1);
      expect(await registry.latestAchievementVersion(PATH_A)).to.equal(2);
    });
  });

  describe("bitcoin evidence", function () {
    it("appends assertions without dropping the earlier one", async function () {
      const { registry, registrar, evidence, issuer } = await loadFixture(deployRegistry);

      await expect(registry.connect(evidence).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_1))
        .to.be.revertedWithCustomError(registry, "TranscriptNotRegistered");
      await expect(registry.connect(issuer).registerTranscript(TRANSCRIPT_DIGEST, TRANSCRIPT_URI, FORMAT))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

      await registry.connect(registrar).registerTranscript(TRANSCRIPT_DIGEST, TRANSCRIPT_URI, FORMAT);
      await expect(registry.connect(registrar).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_1))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

      await registry.connect(evidence).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_1);
      await registry.connect(evidence).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_2);

      expect(await registry.bitcoinEvidenceCount(TRANSCRIPT_DIGEST)).to.equal(2);
      const first = await registry.bitcoinEvidenceAt(TRANSCRIPT_DIGEST, 0);
      const second = await registry.bitcoinEvidenceAt(TRANSCRIPT_DIGEST, 1);
      expect(first.txid).to.equal(TXID_1);
      expect(first.network).to.equal(NETWORK);
      expect(first.assertedBy).to.equal(evidence.address);
      expect(second.txid).to.equal(TXID_2);

      await expect(
        registry.connect(evidence).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_1),
      ).to.be.revertedWithCustomError(registry, "DuplicateBitcoinEvidence");
      await expect(registry.bitcoinEvidenceAt(TRANSCRIPT_DIGEST, 2)).to.be.revertedWithCustomError(
        registry,
        "EvidenceIndexOutOfBounds",
      );
    });
  });

  describe("scoped issuance", function () {
    async function withVersion() {
      const deployed = await deployRegistry();
      await registerPathVersion(deployed.registry, deployed.registrar, PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI);
      await registerPathVersion(deployed.registry, deployed.registrar, PATH_B, 1, SNAPSHOT_V2, SNAPSHOT_URI_V2);
      return deployed;
    }

    it("lets a path issuer mint only that path", async function () {
      const { registry, admin, issuer, otherIssuer, learner, stranger } = await loadFixture(withVersion);

      await expect(
        registry
          .connect(stranger)
          .mint(learner.address, issuanceId("s1"), PATH_A, 1, SNAPSHOT_V1, CREDENTIAL_DIGEST, CREDENTIAL_URI),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(
        registry
          .connect(admin)
          .mint(learner.address, issuanceId("s2"), PATH_A, 1, SNAPSHOT_V1, CREDENTIAL_DIGEST, CREDENTIAL_URI),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

      await registry.connect(admin).grantIssuer(PATH_B, otherIssuer.address);
      await expect(
        registry
          .connect(otherIssuer)
          .mint(learner.address, issuanceId("s3"), PATH_A, 1, SNAPSHOT_V1, CREDENTIAL_DIGEST, CREDENTIAL_URI),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

      const tokenId = await mintCredential(registry, issuer, learner, PATH_A, 1, SNAPSHOT_V1, "scoped-a");
      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);
      expect(await registry.tokenURI(tokenId)).to.equal(CREDENTIAL_URI);
      expect(await registry.locked(tokenId)).to.equal(true);
      expect(await registry.isValid(tokenId)).to.equal(true);
      expect(await registry.activeToken(learner.address, PATH_A, 1)).to.equal(tokenId);

      const credential = await registry.getCredential(tokenId);
      expect(credential.credentialDigest).to.equal(CREDENTIAL_DIGEST);
      expect(credential.issuer).to.equal(issuer.address);
      expect(credential.status).to.equal(Status.Valid);
      expect(credential.replacesTokenId).to.equal(0);
    });

    it("rejects a snapshot digest that does not match the registered version", async function () {
      const { registry, issuer, learner } = await loadFixture(withVersion);
      await expect(
        registry
          .connect(issuer)
          .mint(learner.address, issuanceId("bad-digest"), PATH_A, 1, SNAPSHOT_V2, CREDENTIAL_DIGEST, CREDENTIAL_URI),
      )
        .to.be.revertedWithCustomError(registry, "SnapshotDigestMismatch")
        .withArgs(SNAPSHOT_V2, SNAPSHOT_V1);
    });

    it("mints the same version to two learners and a later version to the first learner", async function () {
      const { registry, registrar, issuer, learner, otherLearner } = await loadFixture(withVersion);

      const first = await mintCredential(registry, issuer, learner, PATH_A, 1, SNAPSHOT_V1, "learner-1");
      const second = await mintCredential(registry, issuer, otherLearner, PATH_A, 1, SNAPSHOT_V1, "learner-2");
      expect(first).to.not.equal(second);

      await registerPathVersion(registry, registrar, PATH_A, 2, SNAPSHOT_V2, SNAPSHOT_URI_V2);
      const third = await mintCredential(registry, issuer, learner, PATH_A, 2, SNAPSHOT_V2, "learner-1-v2");
      expect(await registry.activeToken(learner.address, PATH_A, 1)).to.equal(first);
      expect(await registry.activeToken(learner.address, PATH_A, 2)).to.equal(third);
    });
  });

  describe("duplicate issuance", function () {
    it("reuses neither an issuance id nor a recipient's first credential for that version", async function () {
      const { registry, registrar, issuer, learner, otherLearner } = await loadFixture(deployRegistry);
      await registerPathVersion(registry, registrar, PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI);
      const id = issuanceId("once");

      await registry
        .connect(issuer)
        .mint(learner.address, id, PATH_A, 1, SNAPSHOT_V1, CREDENTIAL_DIGEST, CREDENTIAL_URI);

      await expect(
        registry
          .connect(issuer)
          .mint(otherLearner.address, id, PATH_A, 1, SNAPSHOT_V1, CREDENTIAL_DIGEST, CREDENTIAL_URI),
      ).to.be.revertedWithCustomError(registry, "IssuanceIdUsed");
      await expect(
        registry
          .connect(issuer)
          .mint(learner.address, issuanceId("again"), PATH_A, 1, SNAPSHOT_V1, CREDENTIAL_DIGEST_2, CREDENTIAL_URI_2),
      ).to.be.revertedWithCustomError(registry, "CredentialAlreadyIssued");
    });
  });

  describe("transfers", function () {
    async function minted() {
      const deployed = await deployRegistry();
      await registerPathVersion(deployed.registry, deployed.registrar, PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI);
      const tokenId = await mintCredential(
        deployed.registry,
        deployed.issuer,
        deployed.learner,
        PATH_A,
        1,
        SNAPSHOT_V1,
        "soulbound",
      );
      return { ...deployed, tokenId };
    }

    it("blocks owner transfers, safe transfers, and operator transfers", async function () {
      const { registry, learner, stranger, tokenId } = await loadFixture(minted);

      await expect(
        registry.connect(learner).transferFrom(learner.address, stranger.address, tokenId),
      ).to.be.revertedWithCustomError(registry, "TransferLocked").withArgs(tokenId);
      await expect(
        registry.connect(learner)["safeTransferFrom(address,address,uint256)"](
          learner.address,
          stranger.address,
          tokenId,
        ),
      ).to.be.revertedWithCustomError(registry, "TransferLocked").withArgs(tokenId);
      await expect(
        registry.connect(learner)["safeTransferFrom(address,address,uint256,bytes)"](
          learner.address,
          stranger.address,
          tokenId,
          "0x1234",
        ),
      ).to.be.revertedWithCustomError(registry, "TransferLocked").withArgs(tokenId);
      await expect(
        registry.connect(stranger).transferFrom(learner.address, stranger.address, tokenId),
      ).to.be.revertedWithCustomError(registry, "TransferLocked").withArgs(tokenId);

      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);
      expect(await registry.balanceOf(learner.address)).to.equal(1);
    });

    it("rejects approvals so an approved operator cannot be created", async function () {
      const { registry, learner, stranger, tokenId } = await loadFixture(minted);

      await expect(registry.connect(learner).approve(stranger.address, tokenId)).to.be.revertedWithCustomError(
        registry,
        "ApprovalsDisabled",
      );
      await expect(registry.connect(learner).setApprovalForAll(stranger.address, true)).to.be.revertedWithCustomError(
        registry,
        "ApprovalsDisabled",
      );
      expect(await registry.getApproved(tokenId)).to.equal(ethers.ZeroAddress);
      expect(await registry.isApprovedForAll(learner.address, stranger.address)).to.equal(false);
      await expect(
        registry.connect(stranger).transferFrom(learner.address, stranger.address, tokenId),
      ).to.be.revertedWithCustomError(registry, "TransferLocked").withArgs(tokenId);
    });

    it("reports ERC-721 and ERC-5192 support and locks every minted token", async function () {
      const { registry, tokenId } = await loadFixture(minted);
      const erc721 = "0x80ac58cd";
      const erc5192 = ethers.id("locked(uint256)").slice(0, 10);
      expect(await registry.name()).to.equal("ACBC Educational Credential");
      expect(await registry.symbol()).to.equal("ACBC");
      expect(await registry.supportsInterface(erc721)).to.equal(true);
      expect(await registry.supportsInterface(erc5192)).to.equal(true);
      await expect(registry.locked(999)).to.be.reverted;
      expect(await registry.locked(tokenId)).to.equal(true);
    });
  });

  describe("revocation", function () {
    async function minted() {
      const deployed = await deployRegistry();
      await registerPathVersion(deployed.registry, deployed.registrar, PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI);
      const tokenId = await mintCredential(
        deployed.registry,
        deployed.issuer,
        deployed.learner,
        PATH_A,
        1,
        SNAPSHOT_V1,
        "revoke-me",
      );
      return { ...deployed, tokenId };
    }

    it("lets the scoped issuer or the admin revoke, and keeps the token readable", async function () {
      const { registry, admin, issuer, learner, stranger, tokenId } = await loadFixture(minted);

      await expect(registry.connect(stranger).revoke(tokenId)).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount",
      );

      await expect(registry.connect(issuer).revoke(tokenId))
        .to.emit(registry, "CredentialRevoked")
        .withArgs(tokenId, issuer.address);

      expect(await registry.isValid(tokenId)).to.equal(false);
      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);
      expect(await registry.tokenURI(tokenId)).to.equal(CREDENTIAL_URI);
      expect(await registry.activeToken(learner.address, PATH_A, 1)).to.equal(0);
      const credential = await registry.getCredential(tokenId);
      expect(credential.status).to.equal(Status.Revoked);
      expect(credential.revokedBy).to.equal(issuer.address);
      expect(credential.credentialDigest).to.equal(CREDENTIAL_DIGEST);

      await expect(registry.connect(admin).revoke(tokenId)).to.be.revertedWithCustomError(
        registry,
        "CredentialNotRevocable",
      );
    });

    it("lets the admin revoke when the issuer no longer holds the role", async function () {
      const { registry, admin, issuer, learner } = await loadFixture(minted);
      const tokenId = await registry.tokenIdByIssuanceId(issuanceId("revoke-me"));

      await registry.connect(admin).revokeIssuer(PATH_A, issuer.address);
      expect(await registry.isValid(tokenId)).to.equal(true);
      await expect(registry.connect(issuer).revoke(tokenId)).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount",
      );

      await registry.connect(admin).revoke(tokenId);
      expect(await registry.isValid(tokenId)).to.equal(false);
      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);
    });
  });

  describe("replacement", function () {
    async function minted() {
      const deployed = await deployRegistry();
      await registerPathVersion(deployed.registry, deployed.registrar, PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI);
      await registerPathVersion(deployed.registry, deployed.registrar, PATH_B, 1, SNAPSHOT_V2, SNAPSHOT_URI_V2);
      const tokenId = await mintCredential(
        deployed.registry,
        deployed.issuer,
        deployed.learner,
        PATH_A,
        1,
        SNAPSHOT_V1,
        "original",
      );
      return { ...deployed, tokenId };
    }

    it("links a new issuance to the original and blocks a second successor", async function () {
      const { registry, admin, issuer, otherIssuer, learner, recovered, tokenId } = await loadFixture(minted);
      const nextId = issuanceId("successor");

      await registry.connect(admin).grantIssuer(PATH_B, otherIssuer.address);
      await expect(
        registry.connect(otherIssuer).replace(tokenId, recovered.address, nextId, CREDENTIAL_DIGEST_2, CREDENTIAL_URI_2),
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");

      await expect(
        registry.connect(issuer).replace(tokenId, recovered.address, nextId, CREDENTIAL_DIGEST_2, CREDENTIAL_URI_2),
      ).to.emit(registry, "CredentialReplaced");

      const successorId = await registry.tokenIdByIssuanceId(nextId);
      const original = await registry.getCredential(tokenId);
      const successor = await registry.getCredential(successorId);
      expect(original.status).to.equal(Status.Replaced);
      expect(original.replacedByTokenId).to.equal(successorId);
      expect(successor.status).to.equal(Status.Valid);
      expect(successor.replacesTokenId).to.equal(tokenId);
      expect(successor.achievementKey).to.equal(original.achievementKey);
      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);
      expect(await registry.ownerOf(successorId)).to.equal(recovered.address);
      expect(await registry.activeToken(learner.address, PATH_A, 1)).to.equal(0);
      expect(await registry.activeToken(recovered.address, PATH_A, 1)).to.equal(successorId);
      expect(await registry.isValid(tokenId)).to.equal(false);
      expect(await registry.locked(successorId)).to.equal(true);

      await expect(
        registry
          .connect(issuer)
          .replace(tokenId, learner.address, issuanceId("again"), CREDENTIAL_DIGEST, CREDENTIAL_URI),
      ).to.be.revertedWithCustomError(registry, "SuccessorAlreadyExists");
      await expect(
        registry.connect(issuer).replace(successorId, learner.address, nextId, CREDENTIAL_DIGEST, CREDENTIAL_URI),
      ).to.be.revertedWithCustomError(registry, "IssuanceIdUsed");
    });

    it("keeps a revoked credential revoked when a successor is issued", async function () {
      const { registry, issuer, learner, recovered, tokenId } = await loadFixture(minted);
      await registry.connect(issuer).revoke(tokenId);
      const nextId = issuanceId("after-revoke");
      await registry.connect(issuer).replace(tokenId, recovered.address, nextId, CREDENTIAL_DIGEST_2, CREDENTIAL_URI_2);

      const successorId = await registry.tokenIdByIssuanceId(nextId);
      const original = await registry.getCredential(tokenId);
      expect(original.status).to.equal(Status.Revoked);
      expect(original.replacedByTokenId).to.equal(successorId);
      expect(await registry.isValid(successorId)).to.equal(true);
      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);
    });

    it("reissues to the same wallet and moves the active token", async function () {
      const { registry, issuer, learner, tokenId } = await loadFixture(minted);
      const nextId = issuanceId("same-wallet");
      await registry.connect(issuer).replace(tokenId, learner.address, nextId, CREDENTIAL_DIGEST_2, CREDENTIAL_URI_2);
      const successorId = await registry.tokenIdByIssuanceId(nextId);
      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);
      expect(await registry.ownerOf(successorId)).to.equal(learner.address);
      expect(await registry.activeToken(learner.address, PATH_A, 1)).to.equal(successorId);
      expect((await registry.getCredential(tokenId)).status).to.equal(Status.Replaced);
    });

    it("refuses to put a second valid credential on a wallet that already has one", async function () {
      const { registry, issuer, learner, otherLearner } = await loadFixture(minted);
      const otherId = await mintCredential(registry, issuer, otherLearner, PATH_A, 1, SNAPSHOT_V1, "other");
      await expect(
        registry
          .connect(issuer)
          .replace(otherId, learner.address, issuanceId("collision"), CREDENTIAL_DIGEST_2, CREDENTIAL_URI_2),
      ).to.be.revertedWithCustomError(registry, "CredentialAlreadyIssued");
    });
  });

  describe("pause", function () {
    async function minted() {
      const deployed = await deployRegistry();
      await deployed.registry.connect(deployed.registrar).registerTranscript(TRANSCRIPT_DIGEST, TRANSCRIPT_URI, FORMAT);
      await registerPathVersion(deployed.registry, deployed.registrar, PATH_A, 1, SNAPSHOT_V1, SNAPSHOT_URI);
      const tokenId = await mintCredential(
        deployed.registry,
        deployed.issuer,
        deployed.learner,
        PATH_A,
        1,
        SNAPSHOT_V1,
        "before-pause",
      );
      return { ...deployed, tokenId };
    }

    it("blocks new writes and issuance, leaves verification and revocation available, then resumes", async function () {
      const { registry, registrar, evidence, pauser, issuer, learner, stranger, tokenId } = await loadFixture(minted);

      await expect(registry.connect(issuer).pause()).to.be.revertedWithCustomError(
        registry,
        "AccessControlUnauthorizedAccount",
      );
      await registry.connect(pauser).pause();

      await expect(
        registry.connect(registrar).registerAchievementVersion(PATH_A, 2, SNAPSHOT_V2, SNAPSHOT_URI_V2),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(
        registry.connect(registrar).registerTranscript(ethers.id("other"), TRANSCRIPT_URI, FORMAT),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(
        registry.connect(evidence).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_1),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(
        registry
          .connect(issuer)
          .mint(stranger.address, issuanceId("paused"), PATH_A, 1, SNAPSHOT_V1, CREDENTIAL_DIGEST, CREDENTIAL_URI),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(
        registry.connect(issuer).replace(tokenId, stranger.address, issuanceId("paused-replace"), CREDENTIAL_DIGEST_2, CREDENTIAL_URI_2),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      expect((await registry.getAchievementVersion(PATH_A, 1)).snapshotDigest).to.equal(SNAPSHOT_V1);
      expect(await registry.isValid(tokenId)).to.equal(true);
      await registry.connect(issuer).revoke(tokenId);
      expect(await registry.isValid(tokenId)).to.equal(false);
      expect(await registry.ownerOf(tokenId)).to.equal(learner.address);

      await registry.connect(pauser).unpause();
      await registry.connect(evidence).assertBitcoinEvidence(TRANSCRIPT_DIGEST, NETWORK, TXID_1);
      expect(await registry.bitcoinEvidenceCount(TRANSCRIPT_DIGEST)).to.equal(1);
      const resumed = await mintCredential(registry, issuer, stranger, PATH_A, 1, SNAPSHOT_V1, "after-pause");
      expect(await registry.isValid(resumed)).to.equal(true);
    });
  });
});
