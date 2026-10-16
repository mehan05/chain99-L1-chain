// =============================================================
// Chain99 — L1 Demo Client
// Connects to the running devnet via JSON-RPC and:
//   1. Reads chain info (chainId, blockNumber)
//   2. Checks validator balance
//   3. Sends a C99 transfer
//   4. Deploys the Storage.sol contract
//   5. Writes a value to the contract (set)
//   6. Reads it back (value)
// =============================================================

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "..");
const RPC  = "http://127.0.0.1:8545";

function banner(title) {
  console.log("\n" + "─".repeat(50));
  console.log(`  ${title}`);
  console.log("─".repeat(50));
}

async function main() {
  // ── Connect ─────────────────────────────────────────────────
  banner("🔗 Connecting to Chain99 L1");
  const provider = new ethers.JsonRpcProvider(RPC);

  // Basic sanity-check: is the node reachable?
  let network;
  try {
    network = await provider.getNetwork();
  } catch (err) {
    console.error("❌ Cannot reach node at", RPC);
    console.error("   Did you run:  ./scripts/launch-chain.sh ?");
    process.exit(1);
  }

  console.log(`✅ Connected!`);
  console.log(`   Chain ID   : ${network.chainId}`);
  console.log(`   Chain Name : Chain99`);

  // ── Load wallet from keystore ────────────────────────────────
  banner("🔑 Loading Validator Wallet");
  const keystoreDir  = path.join(BASE, "data/node1/keystore");
  const keystoreFile = fs.readdirSync(keystoreDir)[0];
  const keystoreJson = fs.readFileSync(path.join(keystoreDir, keystoreFile), "utf8");
  const password     = fs.readFileSync(path.join(BASE, "geth/password.txt"), "utf8").trim();

  process.stdout.write("   Decrypting keystore... ");
  const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
  const signer = wallet.connect(provider);
  console.log("done");
  console.log(`   Address    : ${signer.address}`);

  // ── Block info ───────────────────────────────────────────────
  banner("⛓️  Chain State");
  const blockNumber = await provider.getBlockNumber();
  const block       = await provider.getBlock(blockNumber);
  const balance     = await provider.getBalance(signer.address);

  console.log(`   Latest Block : #${blockNumber}`);
  console.log(`   Block Hash   : ${block.hash}`);
  console.log(`   Block Time   : ${new Date(Number(block.timestamp) * 1000).toISOString()}`);
  console.log(`   Validator Bal: ${ethers.formatEther(balance)} C99`);

  // ── Send a transfer ──────────────────────────────────────────
  banner("💸 Sending C99 Transfer");
  const receiver = ethers.Wallet.createRandom().address;
  const amount   = ethers.parseEther("10.0");

  console.log(`   To     : ${receiver}`);
  console.log(`   Amount : 10.0 C99`);

  const tx = await signer.sendTransaction({ to: receiver, value: amount });
  console.log(`   Tx Hash: ${tx.hash}`);
  process.stdout.write("   Waiting for confirmation... ");
  const receipt = await tx.wait();
  console.log(`confirmed in block #${receipt.blockNumber}`);

  const receiverBal = await provider.getBalance(receiver);
  console.log(`   Receiver Balance: ${ethers.formatEther(receiverBal)} C99 ✅`);

  // ── Load contract artifacts ──────────────────────────────────
  banner("📄 Deploying Storage Contract");
  const buildDir = path.join(BASE, "contracts/build");
  const buildFiles = fs.readdirSync(buildDir);
  const abiFile = buildFiles.find(f => f.endsWith(".abi"));
  const binFile = buildFiles.find(f => f.endsWith(".bin"));

  if (!abiFile || !binFile) {
    console.error("❌ ABI/BIN not found in contracts/build/");
    console.error("   Run:  solc --bin --abi contracts/Storage.sol -o contracts/build/");
    process.exit(1);
  }

  const abi = fs.readFileSync(path.join(buildDir, abiFile), "utf8");
  const bin = fs.readFileSync(path.join(buildDir, binFile), "utf8");

  const factory  = new ethers.ContractFactory(abi, `0x${bin.trim()}`, signer);
  const contract = await factory.deploy();
  console.log(`   Deploy Tx: ${contract.deploymentTransaction()?.hash}`);
  process.stdout.write("   Waiting for deployment... ");
  await contract.waitForDeployment();
  const contractAddr = await contract.getAddress();
  console.log(`done`);
  console.log(`   Contract : ${contractAddr} ✅`);

  // ── Write to contract ────────────────────────────────────────
  banner("✍️  Writing to Contract (set 99)");
  const sc    = new ethers.Contract(contractAddr, abi, signer);
  const setTx = await sc.getFunction("set")(99);
  process.stdout.write(`   Tx Hash: ${setTx.hash}\n   Waiting... `);
  const setReceipt = await setTx.wait();
  console.log(`confirmed in block #${setReceipt.blockNumber}`);

  // ── Read from contract ───────────────────────────────────────
  banner("📖 Reading from Contract (value)");
  const val = await sc.getFunction("value")();
  console.log(`   Stored value: ${val.toString()}`);
  console.log(val.toString() === "99" ? "   ✅ Value matches!" : "   ❌ Unexpected value!");

  // ── Summary ──────────────────────────────────────────────────
  banner("🎉 Chain99 Demo Complete");
  console.log(`   Chain ID      : 9999`);
  console.log(`   Native Token  : C99`);
  console.log(`   Consensus     : Clique PoA`);
  console.log(`   Final Block   : #${await provider.getBlockNumber()}`);
  console.log(`   Contract Addr : ${contractAddr}`);
  console.log("");
}

main().catch(err => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
