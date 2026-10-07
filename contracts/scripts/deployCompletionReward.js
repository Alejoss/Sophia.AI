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

  const factory = await hre.ethers.getContractFactory("ACBCSophiaCompletionReward");
  const deployTx = await factory.getDeployTransaction(deployer.address);
  const estimated = await hre.ethers.provider.estimateGas({
    ...deployTx,
    from: deployer.address,
  });
  const gasLimit = estimated * 115n / 100n;
  const block = await hre.ethers.provider.getBlock("latest");
  const base = block.baseFeePerGas ?? 1_000_000_000n;
  const maxFee = base * 12n / 10n;
  const reserved = maxFee * gasLimit;
  console.log("Estimated gas:", estimated.toString());
  console.log("ETH reserved:", hre.ethers.formatEther(reserved));
  if (reserved > balance) {
    throw new Error(
      `Need about ${hre.ethers.formatEther(reserved)} ETH; balance is ${hre.ethers.formatEther(balance)} ETH.`,
    );
  }
  const contract = await factory.deploy(deployer.address, {
    gasLimit,
    maxFeePerGas: maxFee,
    maxPriorityFeePerGas: maxFee > base ? (maxFee - base) / 2n : 1n,
  });
  const deployment = contract.deploymentTransaction();
  const receipt = await deployment.wait();
  const address = await contract.getAddress();

  console.log("ACBCSophiaCompletionReward:", address);
  console.log("Transaction:", receipt.hash);
  console.log("Gas used:", receipt.gasUsed.toString());
  console.log("Name:", await contract.name());
  console.log("Symbol:", await contract.symbol());
  if (hre.network.name !== "sepolia") {
    return;
  }

  const record = {
    network: "sepolia",
    chainId: 11155111,
    contract: "ACBCSophiaCompletionReward",
    address,
    deployer: deployer.address,
    admin: deployer.address,
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    deployedAt: new Date().toISOString(),
  };
  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "sepolia-completion-reward.json"), JSON.stringify(record, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
