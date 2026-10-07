const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");
  if (balance === 0n) {
    throw new Error("Deployer has no Sepolia ETH");
  }

  const factory = await hre.ethers.getContractFactory("ACBCSophiaCredentialRegistry");
  const contract = await factory.deploy(deployer.address);
  const deployment = contract.deploymentTransaction();
  const receipt = await deployment.wait();
  const address = await contract.getAddress();

  console.log("ACBCSophiaCredentialRegistry:", address);
  console.log("Transaction:", receipt.hash);
  console.log("Name:", await contract.name());
  console.log("Symbol:", await contract.symbol());

  const record = {
    network: "sepolia",
    chainId: 11155111,
    contract: "ACBCSophiaCredentialRegistry",
    address,
    deployer: deployer.address,
    admin: deployer.address,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "sepolia-credential-registry.json"), JSON.stringify(record, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
