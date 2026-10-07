const fs = require("fs");
const path = require("path");

require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition-ethers");
require("hardhat-contract-sizer");
require("./tasks/FunctionTasks");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [{ version: "0.8.24" }],
    overrides: {
      "contracts/ACBCSophiaCompletionReward.sol": {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic: "dentist whale pattern drastic time black cigar bike person destroy punch hungry",
        initialBalance: "10000000000000000000000",
        count: 100
      }
    },
    testnet: {
      chainId: 80002,
      url: "https://rpc-amoy.polygon.technology",
      accounts: {
        mnemonic: process.env.MNEMONIC || 'invalid-mnemonic-please-set-one',
        count: 100
      }
    },
    mainnet: {
      chainId: 137,
      url: "https://polygon-mainnet.infura.io",
      accounts: {
        mnemonic: process.env.MNEMONIC || 'invalid-mnemonic-please-set-one',
        count: 100
      }
    },
    sepolia: {
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    }
  }
};
