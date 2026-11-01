require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      accounts: {
        count: 10,
        accountsBalance: "1000000000000000000000000" // 1,000,000 C99 per test account
      }
    },
    chain99: {
      url: "http://127.0.0.1:8545",
      chainId: 9999,
      accounts: [
        "0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c"
      ]
    }
  }
};

