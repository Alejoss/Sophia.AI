const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TranscriptAnchorRegistry", function () {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("TranscriptAnchorRegistry");
    const registry = await Registry.deploy(owner.address);
    await registry.waitForDeployment();
    return { registry, owner, alice, bob };
  }

  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("transcript-plain-text"));
  const sampleBtcTx = ethers.keccak256(ethers.toUtf8Bytes("btc-txid-placeholder"));

  it("owner stores hash, CID and btc txid", async function () {
    const { registry, owner } = await deploy();
    await expect(
      registry.connect(owner).storeAnchor(sampleHash, sampleBtcTx, "bafycidexample")
    ).to.emit(registry, "TranscriptAnchored");

    const anchor = await registry.getAnchor(sampleHash);
    expect(anchor.exists).to.equal(true);
    expect(anchor.textHash).to.equal(sampleHash);
    expect(anchor.btcTxId).to.equal(sampleBtcTx);
    expect(anchor.ipfsCid).to.equal("bafycidexample");
    expect(anchor.recordedBy).to.equal(owner.address);
    expect(await registry.isHashStored(sampleHash)).to.equal(true);
    expect(await registry.getHashByBtcTxId(sampleBtcTx)).to.equal(sampleHash);
  });

  it("rejects non-owner storeAnchor", async function () {
    const { registry, alice } = await deploy();
    await expect(
      registry.connect(alice).storeAnchor(sampleHash, ethers.ZeroHash, "")
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
      .withArgs(alice.address);
  });

  it("rejects duplicate hash", async function () {
    const { registry, owner } = await deploy();
    await registry.connect(owner).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await expect(
      registry.connect(owner).storeAnchor(sampleHash, ethers.ZeroHash, "")
    ).to.be.revertedWith("Hash already stored");
  });

  it("allows owner to set btc txid later", async function () {
    const { registry, owner } = await deploy();
    await registry.connect(owner).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await registry.connect(owner).setBtcTxId(sampleHash, sampleBtcTx);
    const anchor = await registry.getAnchor(sampleHash);
    expect(anchor.btcTxId).to.equal(sampleBtcTx);
  });

  it("rejects non-owner setBtcTxId", async function () {
    const { registry, owner, alice } = await deploy();
    await registry.connect(owner).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await expect(
      registry.connect(alice).setBtcTxId(sampleHash, sampleBtcTx)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
      .withArgs(alice.address);
  });

  it("allows owner to update IPFS CID", async function () {
    const { registry, owner } = await deploy();
    await registry.connect(owner).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await expect(registry.connect(owner).setIpfsCid(sampleHash, "bafynew"))
      .to.emit(registry, "IpfsCidUpdated")
      .withArgs(sampleHash, "bafynew");
    expect((await registry.getAnchor(sampleHash)).ipfsCid).to.equal("bafynew");
  });

  it("rejects non-owner setIpfsCid", async function () {
    const { registry, owner, bob } = await deploy();
    await registry.connect(owner).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await expect(
      registry.connect(bob).setIpfsCid(sampleHash, "nope")
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount")
      .withArgs(bob.address);
  });

  it("public reads still work for anyone", async function () {
    const { registry, owner, alice } = await deploy();
    await registry.connect(owner).storeAnchor(sampleHash, sampleBtcTx, "bafy");
    expect(await registry.connect(alice).isHashStored(sampleHash)).to.equal(true);
    const anchor = await registry.connect(alice).getAnchor(sampleHash);
    expect(anchor.ipfsCid).to.equal("bafy");
  });
});
