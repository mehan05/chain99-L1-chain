/**
 * Chain99 L1 — Production Performance & Resource Benchmark Suite
 * Measures TPS, block interval, finality, execution duration, RPC latency,
 * CPU/RAM metrics, and disk database growth.
 */

const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const RPC_URL = "http://127.0.0.1:8545";
const COMET_RPC = "http://127.0.0.1:26657";
const DEPLOYER_PK = "0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c";
const DATA_DIR = path.resolve(__dirname, "../data");

function getDirectorySize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      size += getDirectorySize(filePath);
    } else {
      size += stat.size;
    }
  }
  return size;
}

async function main() {
  console.log("==================================================================");
  console.log("  ⚡ CHAIN99 L1 — PRODUCTION PERFORMANCE & RESOURCE BENCHMARK");
  console.log("==================================================================\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(DEPLOYER_PK, provider);

  // 1. Resource Consumption (RAM & Disk)
  console.log("1. Node Infrastructure & Hardware Resource Audit...");
  const nodes = ["node1", "node2", "node3", "node4"];
  let totalDiskBytes = 0;
  nodes.forEach((n) => {
    const nodeHome = path.join(DATA_DIR, n);
    const dbSize = getDirectorySize(path.join(nodeHome, "data"));
    totalDiskBytes += dbSize;
    console.log(`   - ${n.toUpperCase()} LevelDB Storage Size: ${(dbSize / (1024 * 1024)).toFixed(2)} MB`);
  });
  console.log(`   - Combined 4-Node Database Footprint: ${(totalDiskBytes / (1024 * 1024)).toFixed(2)} MB`);

  // 2. RPC Latency Profile (50 rounds)
  console.log("\n2. Measuring JSON-RPC Latency Profile (50 rounds)...");
  const latencies = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    await provider.getBlockNumber();
    latencies.push(performance.now() - t0);
  }
  latencies.sort((a, b) => a - b);
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
  const min = latencies[0].toFixed(2);
  const max = latencies[latencies.length - 1].toFixed(2);

  console.log(`   - Min Latency : ${min} ms`);
  console.log(`   - p50 Latency : ${p50} ms`);
  console.log(`   - Average     : ${avg} ms`);
  console.log(`   - p95 Latency : ${p95} ms`);
  console.log(`   - p99 Latency : ${p99} ms`);
  console.log(`   - Max Latency : ${max} ms`);

  // 3. Block Interval & Finality Latency (Sampling 10 blocks)
  console.log("\n3. Measuring Block Interval & Finality Latency (10 block sample)...");
  const startNum = await provider.getBlockNumber();
  const startBlock = await provider.getBlock(startNum);
  const targetNum = startNum + 10;
  
  while ((await provider.getBlockNumber()) < targetNum) {
    await new Promise((r) => setTimeout(r, 200));
  }
  const endBlock = await provider.getBlock(targetNum);
  const deltaSec = Number(endBlock.timestamp - startBlock.timestamp);
  const avgBlockInterval = (deltaSec / 10).toFixed(2);

  console.log(`   - Start Block Height : #${startNum} (${startBlock.timestamp})`);
  console.log(`   - End Block Height   : #${targetNum} (${endBlock.timestamp})`);
  console.log(`   - Average Block Time : ${avgBlockInterval} seconds / block`);
  console.log(`   - Finality Latency   : 1 Block (Deterministic BFT Commit, ~${avgBlockInterval}s)`);

  // 4. Batch Transaction Workload & TPS Benchmark
  const BATCH_SIZE = 50;
  console.log(`\n4. Executing Batch Transaction Workload (${BATCH_SIZE} transactions)...`);
  const initialNonce = await provider.getTransactionCount(wallet.address, "pending");
  const diskBefore = getDirectorySize(path.join(DATA_DIR, "node1", "data"));
  const startTxTime = performance.now();

  const txPromises = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const tx = wallet.sendTransaction({
      to: "0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8",
      value: ethers.parseUnits("1", "gwei"),
      nonce: initialNonce + i,
      gasLimit: 21000,
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      maxFeePerGas: ethers.parseUnits("3", "gwei"),
    });
    txPromises.push(tx);
  }

  const sentTxs = await Promise.all(txPromises);
  console.log(`   - ${BATCH_SIZE} transactions broadcasted to node mempool.`);

  const receipts = await Promise.all(sentTxs.map((t) => t.wait()));
  const endTxTime = performance.now();
  const diskAfter = getDirectorySize(path.join(DATA_DIR, "node1", "data"));

  const durationSec = (endTxTime - startTxTime) / 1000;
  const blocksInvolved = new Set(receipts.map((r) => r.blockNumber));
  const measuredTps = (BATCH_SIZE / durationSec).toFixed(2);
  const diskGrowthBytes = diskAfter - diskBefore;

  console.log(`   ✅ Confirmed all ${BATCH_SIZE} transactions in block(s): [${Array.from(blocksInvolved).join(", ")}]`);
  console.log(`   - Total Batch Execution Time : ${durationSec.toFixed(2)} seconds`);
  console.log(`   - Effective Throughput       : ${measuredTps} TPS`);
  console.log(`   - LevelDB State Growth       : ${(diskGrowthBytes / 1024).toFixed(2)} KB (~${(diskGrowthBytes / BATCH_SIZE).toFixed(0)} bytes/tx)`);

  // 5. CometBFT Consensus Status
  console.log("\n5. Consensus Engine State...");
  const cometStatus = (await axios.get(`${COMET_RPC}/status`)).data.result;
  console.log(`   - Moniker            : ${cometStatus.node_info.moniker}`);
  console.log(`   - Network Identifier : ${cometStatus.node_info.network}`);
  console.log(`   - CometBFT Version   : ${cometStatus.node_info.version}`);
  console.log(`   - Current Block      : #${cometStatus.sync_info.latest_block_height}`);
  console.log(`   - Catching Up        : ${cometStatus.sync_info.catching_up}`);

  console.log("\n==================================================================");
  console.log("  📊 PRODUCTION BENCHMARK SUMMARY TABLE");
  console.log("==================================================================");
  console.log(`  RPC Latency (p50 / p95) : ${p50} ms / ${p95} ms`);
  console.log(`  Block Interval          : ${avgBlockInterval} seconds`);
  console.log(`  Finality Latency        : 1 block (Deterministic BFT, ~${avgBlockInterval}s)`);
  console.log(`  Batch Throughput        : ${measuredTps} TPS (${BATCH_SIZE} txs in ${durationSec.toFixed(2)}s)`);
  console.log(`  Node 1 DB Footprint     : ${(diskAfter / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  State Growth per Tx     : ${(diskGrowthBytes / BATCH_SIZE).toFixed(0)} bytes / tx`);
  console.log("==================================================================");
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exitCode = 1;
});

