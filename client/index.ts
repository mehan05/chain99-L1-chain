import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  
  // Read keystore and password
  const keystoreDir = path.join(__dirname, "../data/node1/keystore");
  const keystoreFiles = fs.readdirSync(keystoreDir);
  const keystorePath = path.join(keystoreDir, keystoreFiles[0]);
  const keystoreJson = fs.readFileSync(keystorePath, "utf8");
  const password = fs.readFileSync(path.join(__dirname, "../geth/password.txt"), "utf8").trim();

  console.log("Decrypting wallet...");
  const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
  const connectedWallet = wallet.connect(provider);

  console.log("Connected to Chain99!");
  console.log(`Wallet Address: ${connectedWallet.address}`);
  
  // 1. Read latest block
  const blockNumber = await provider.getBlockNumber();
  console.log(`Latest block number: ${blockNumber}`);
  
  // 2. Check balance
  const balance = await provider.getBalance(connectedWallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} C99`);

  // 3. Send C99
  const receiver = ethers.Wallet.createRandom().address;
  console.log(`Sending 10 C99 to ${receiver}...`);
  const tx = await connectedWallet.sendTransaction({
    to: receiver,
    value: ethers.parseEther("10.0")
  });
  console.log(`Transaction hash: ${tx.hash}`);
  await tx.wait();
  console.log(`Transaction confirmed!`);
  
  const receiverBalance = await provider.getBalance(receiver);
  console.log(`Receiver balance: ${ethers.formatEther(receiverBalance)} C99`);

  // 4. Deploy Contract
  console.log("Deploying Storage contract...");
  const abiPath = path.join(__dirname, "../contracts/build/__contracts_Storage_sol_Storage.abi");
  const binPath = path.join(__dirname, "../contracts/build/__contracts_Storage_sol_Storage.bin");
  
  const abi = fs.readFileSync(abiPath, "utf8");
  const bin = fs.readFileSync(binPath, "utf8");
  
  const factory = new ethers.ContractFactory(abi, bin, connectedWallet);
  const contract = await factory.deploy();
  const txHash = contract.deploymentTransaction()?.hash;
  console.log(`Deployment transaction hash: ${txHash}`);
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`Contract deployed at: ${contractAddress}`);

  // 5. Interact with Contract
  console.log("Setting value to 99...");
  const setContract = new ethers.Contract(contractAddress, abi, connectedWallet);
  const setTx = await setContract.getFunction("set")(99);
  await setTx.wait();
  console.log(`Set transaction confirmed: ${setTx.hash}`);

  // 6. Read updated state
  const value = await setContract.getFunction("value")();
  console.log(`Read value from contract: ${value.toString()}`);
}

main().catch(console.error);
