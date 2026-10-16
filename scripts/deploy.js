const hre = require("hardhat");

async function main() {
  console.log("\n========================================================");
  console.log("  🚀 Hardhat Deployment & Execution on Chain99 L1");
  console.log("========================================================");

  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();

  console.log(`🔗 Connected Network : ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer Account  : ${deployer.address}`);

  const balance = await provider.getBalance(deployer.address);
  console.log(`💰 Deployer Balance  : ${hre.ethers.formatEther(balance)} C99`);

  const startBlock = await provider.getBlockNumber();
  console.log(`⛓️  Current Block    : #${startBlock}`);

  // ── 1. Deploy the Contract ─────────────────────────────────
  console.log("\n📄 1. Deploying Storage.sol contract...");
  const Storage = await hre.ethers.getContractFactory("Storage");
  const storage = await Storage.deploy();
  await storage.waitForDeployment();

  const contractAddress = await storage.getAddress();
  const deployTx = storage.deploymentTransaction();
  console.log(`   ✅ Storage contract deployed at: ${contractAddress}`);
  console.log(`   📝 Deploy Tx Hash: ${deployTx.hash}`);

  // Automatically sync with frontend UI
  try {
    const fs = require("fs");
    const path = require("path");
    const jsonPath = path.join(__dirname, "../frontend-next/public/latest_contract.json");
    fs.writeFileSync(jsonPath, JSON.stringify({ address: contractAddress, deployedAt: new Date().toISOString() }, null, 2));
    console.log(`   🌐 Synced with Next.js frontend (frontend-next/public/latest_contract.json)`);
  } catch (e) {}

  // ── 2. Read Initial Value (Instruction 1) ───────────────────
  console.log("\n📖 2. Executing Read Instruction: value()...");
  let currentValue = await storage.value();
  console.log(`   Current on-chain value: ${currentValue.toString()}`);

  // ── 3. Mutate State (Instruction 2: set(420)) ───────────────
  console.log("\n✍️  3. Executing State Mutation Instruction: set(420)...");
  const tx1 = await storage.set(420);
  console.log(`   Tx Hash: ${tx1.hash}`);
  process.stdout.write("   Waiting for Clique block confirmation (2s)... ");
  const receipt1 = await tx1.wait();
  console.log(`Mined in block #${receipt1.blockNumber}! Gas used: ${receipt1.gasUsed}`);

  // ── 4. Verify Updated Value (Instruction 3) ─────────────────
  console.log("\n📖 4. Reading updated state from Chain99 storage trie...");
  currentValue = await storage.value();
  console.log(`   Updated on-chain value: ${currentValue.toString()}`);
  if (currentValue.toString() === "420") {
    console.log("   ✅ SUCCESS: State was successfully modified on-chain!");
  }

  // ── 5. Second Instruction: set(999) ─────────────────────────
  console.log("\n✍️  5. Executing Second Mutation Instruction: set(999)...");
  const tx2 = await storage.set(999);
  console.log(`   Tx Hash: ${tx2.hash}`);
  process.stdout.write("   Waiting for confirmation... ");
  const receipt2 = await tx2.wait();
  console.log(`Mined in block #${receipt2.blockNumber}! Gas used: ${receipt2.gasUsed}`);

  const finalValue = await storage.value();
  console.log(`   Final on-chain value: ${finalValue.toString()}`);

  const endBlock = await provider.getBlockNumber();

  console.log("\n========================================================");
  console.log("  🎉 Chain99 Hardhat Execution Complete!");
  console.log("========================================================");
  console.log(`  Contract Address : ${contractAddress}`);
  console.log(`  Initial Block    : #${startBlock}`);
  console.log(`  Final Block      : #${endBlock}`);
  console.log(`  Blocks Produced  : ${endBlock - startBlock}`);
  console.log(`  Chain ID         : ${network.chainId}`);
  console.log("========================================================\n");
}

main().catch((error) => {
  console.error("❌ Execution error:", error);
  process.exitCode = 1;
});
