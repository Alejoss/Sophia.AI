require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition-ethers");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
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
    }
  }
};
