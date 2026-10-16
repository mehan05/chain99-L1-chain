const { ethers } = require("ethers");
const fs = require("fs");

const wallet = ethers.Wallet.createRandom();
const account = {
    address: wallet.address,
    privateKey: wallet.privateKey
};

fs.writeFileSync("geth/dev_account.json", JSON.stringify(account, null, 2));
console.log("Account created:", wallet.address);
