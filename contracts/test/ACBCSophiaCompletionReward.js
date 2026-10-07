const { expect } = require("chai");
const { ethers } = require("hardhat");

function issuanceId(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

describe("ACBCSophiaCompletionReward", function () {
  async function deploy() {
    const [admin, minter, learner, buyer] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("ACBCSophiaCompletionReward");
    const reward = await factory.deploy(admin.address);
    await reward.grantRole(await reward.MINTER_ROLE(), minter.address);
    return { admin, minter, learner, buyer, reward };
  }

  it("names the transferable reward and withholds the minter role from admin", async function () {
    const { admin, reward } = await deploy();
    expect(await reward.name()).to.equal("ACBC Completion Reward");
    expect(await reward.symbol()).to.equal("ACBC");
    expect(await reward.hasRole(await reward.MINTER_ROLE(), admin.address)).to.equal(false);
    expect(await reward.hasRole(await reward.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
  });

  it("mints once and lets the holder transfer the token", async function () {
    const { minter, learner, buyer, reward } = await deploy();
    const id = issuanceId("sophia-acbc:reward:one");
    await reward.connect(minter).mint(learner.address, id, "https://example/reward/1");

    expect(await reward.ownerOf(1)).to.equal(learner.address);
    expect(await reward.tokenURI(1)).to.equal("https://example/reward/1");
    expect(await reward.tokenIdByIssuanceId(id)).to.equal(1n);

    await reward.connect(learner).transferFrom(learner.address, buyer.address, 1);
    expect(await reward.ownerOf(1)).to.equal(buyer.address);
  });

  it("rejects a second mint with the same issuance id and a caller without the role", async function () {
    const { admin, minter, learner, reward } = await deploy();
    const id = issuanceId("sophia-acbc:reward:once");
    await reward.connect(minter).mint(learner.address, id, "https://example/reward/once");

    await expect(
      reward.connect(minter).mint(learner.address, id, "https://example/reward/again"),
    ).to.be.revertedWithCustomError(reward, "IssuanceIdUsed");

    await expect(
      reward.connect(admin).mint(learner.address, issuanceId("other"), "https://example/reward/2"),
    ).to.be.reverted;
  });
});
