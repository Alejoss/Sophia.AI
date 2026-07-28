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

  it("stores hash, CID and btc txid", async function () {
    const { registry, alice } = await deploy();
    await expect(
      registry.connect(alice).storeAnchor(sampleHash, sampleBtcTx, "bafycidexample")
    ).to.emit(registry, "TranscriptAnchored");

    const anchor = await registry.getAnchor(sampleHash);
    expect(anchor.exists).to.equal(true);
    expect(anchor.textHash).to.equal(sampleHash);
    expect(anchor.btcTxId).to.equal(sampleBtcTx);
    expect(anchor.ipfsCid).to.equal("bafycidexample");
    expect(anchor.recordedBy).to.equal(alice.address);
    expect(await registry.isHashStored(sampleHash)).to.equal(true);
    expect(await registry.getHashByBtcTxId(sampleBtcTx)).to.equal(sampleHash);
  });

  it("rejects duplicate hash", async function () {
    const { registry, alice } = await deploy();
    await registry.connect(alice).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await expect(
      registry.connect(alice).storeAnchor(sampleHash, ethers.ZeroHash, "")
    ).to.be.revertedWith("Hash already stored");
  });

  it("allows setting btc txid later", async function () {
    const { registry, alice } = await deploy();
    await registry.connect(alice).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await registry.connect(alice).setBtcTxId(sampleHash, sampleBtcTx);
    const anchor = await registry.getAnchor(sampleHash);
    expect(anchor.btcTxId).to.equal(sampleBtcTx);
  });

  it("allows updating IPFS CID", async function () {
    const { registry, alice } = await deploy();
    await registry.connect(alice).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await expect(registry.connect(alice).setIpfsCid(sampleHash, "bafynew"))
      .to.emit(registry, "IpfsCidUpdated")
      .withArgs(sampleHash, "bafynew");
    expect((await registry.getAnchor(sampleHash)).ipfsCid).to.equal("bafynew");
  });

  it("rejects unauthorized CID update", async function () {
    const { registry, alice, bob } = await deploy();
    await registry.connect(alice).storeAnchor(sampleHash, ethers.ZeroHash, "");
    await expect(
      registry.connect(bob).setIpfsCid(sampleHash, "nope")
    ).to.be.revertedWith("Not authorized");
  });
});
