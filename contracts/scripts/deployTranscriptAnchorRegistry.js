const { ethers } = require("hardhat");

/**
 * Deploy TranscriptAnchorRegistry.
 * Usage: npx hardhat run scripts/deployTranscriptAnchorRegistry.js --network hardhat
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying TranscriptAnchorRegistry with:", deployer.address);

  const Registry = await ethers.getContractFactory("TranscriptAnchorRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log("TranscriptAnchorRegistry deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
