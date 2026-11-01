const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n========================================================");
  console.log("  🚀 Deploying C99Staking (Proof-of-Stake) on Chain99");
  console.log("========================================================");

  const [deployer] = await hre.ethers.getSigners();
  const provider = hre.ethers.provider;
  const network = await provider.getNetwork();

  console.log(`🔗 Network      : ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`👤 Deployer     : ${deployer.address}`);

  const balance = await provider.getBalance(deployer.address);
  console.log(`💰 Balance      : ${hre.ethers.formatEther(balance)} C99`);

  // 1. Deploy C99Staking contract
  console.log("\n📄 1. Deploying C99Staking.sol...");
  const C99Staking = await hre.ethers.getContractFactory("C99Staking");
  
  // Deploy with deployer as consensus reporter and 2-hour unbonding for devnet
  const unbondingPeriod = 7200; // 2 hours
  const staking = await C99Staking.deploy(deployer.address, unbondingPeriod);
  await staking.waitForDeployment();

  const stakingAddress = await staking.getAddress();
  console.log(`   ✅ C99Staking deployed at: ${stakingAddress}`);

  // 2. Register initial bootstrap validator
  console.log("\n🔑 2. Registering Bootstrap Validator...");
  const ed25519PubKey = hre.ethers.hexlify(hre.ethers.randomBytes(32));
  const selfBondAmount = hre.ethers.parseEther("10000"); // 10,000 C99 minimum self-bond
  const commissionBps = 500; // 5%

  const regTx = await staking.registerValidator(
    ed25519PubKey,
    "Chain99-Genesis-Validator-1",
    commissionBps,
    { value: selfBondAmount }
  );
  await regTx.wait();
  console.log(`   ✅ Registered validator: ${deployer.address}`);
  console.log(`   📝 Self-Bond: 10,000 C99 | Commission: 5%`);

  // 3. Query voting power & active set
  const votingPower = await staking.getVotingPower(deployer.address);
  const activeValidators = await staking.getActiveValidators();
  console.log(`\n📊 3. Consensus Status:`);
  console.log(`   Consensus Voting Power: ${votingPower.toString()} units`);
  console.log(`   Active Validator Count: ${activeValidators.length}`);

  // 4. Export deployment artifact for frontend & tooling
  const deploymentMetadata = {
    address: stakingAddress,
    chainId: Number(network.chainId),
    unbondingPeriodSeconds: unbondingPeriod,
    deployedAt: new Date().toISOString(),
    initialValidator: deployer.address
  };

  const outputPath = path.join(__dirname, "../frontend-next/public/staking_contract.json");
  try {
    fs.writeFileSync(outputPath, JSON.stringify(deploymentMetadata, null, 2));
    console.log(`\n🌐 Synced with frontend UI: ${outputPath}`);
  } catch (e) {
    console.warn("   Frontend folder not reachable, skipping UI sync.");
  }

  console.log("\n========================================================");
  console.log("  🎉 C99 PoS Staking Deployment & Bootstrap Complete!");
  console.log("========================================================\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
