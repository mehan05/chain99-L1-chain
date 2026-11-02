/**
 * Chain99 L1 — Dedicated Stress Testing & Resilience Worker Engine
 * Production-grade background worker for high-throughput transaction generation,
 * multi-wallet nonce pipelining, real-time BFT consensus & node telemetry,
 * chain failure detection, and benchmark report generation.
 */

import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import os from "os";
import { getNodeStatuses } from "./node-manager";

// ── Default Network & Account Configuration ───────────────────────────────────
const DEFAULT_RPC = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";
const DEFAULT_COMET_RPC = process.env.COMET_RPC || "http://127.0.0.1:26657";
const DEFAULT_COSMOS_REST = process.env.COSMOS_REST || "http://127.0.0.1:1317";

const DEPLOYER_PK =
  process.env.FAUCET_PRIVATE_KEY ||
  "0xd7e362021fa1878975c5cdd458d493cd2f01dd19554654eeb2a3dca4e428b62c";

const STAKING_PRECOMPILE = "0x0000000000000000000000000000000000000800";
const STORAGE_ABI = ["function set(uint256 _value)", "function value() view returns (uint256)"];
const STAKING_ABI = [
  "function delegate(address delegatorAddress, string validatorAddress, uint256 amount) returns (int64 completionTime)",
];

const KNOWN_VALIDATORS = [
  "c99valoper18v9ejkkqn83pm5gcdqkxgpjt02e2fef7wf2tn9", // Validator A
  "c99valoper1r9dck9unakj56yc6g6u0nmfn6pqz89l7n678q5", // Validator B
  "c99valoper1pq5suzunkygxhkxt5va9gk0zap677eee2knc0j", // Validator C
  "c99valoper12tmwmlw7n7c7zu7cgdluzandq95uwe5vl5cehh", // Validator D
];

// Helper: Measure directory size on disk (LevelDB)
function getDirectorySize(dirPath) {
  let size = 0;
  if (!fs.existsSync(dirPath)) return 0;
  try {
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
  } catch {
    // ignore transient locks during read
  }
  return size;
}

// ── StressEngine Singleton Class ──────────────────────────────────────────────
class StressEngine {
  constructor() {
    this.status = "idle"; // 'idle' | 'running' | 'paused' | 'stopping' | 'completed' | 'error'
    this.healthStatus = "Healthy"; // 'Healthy' | 'Under Load' | 'Degraded' | 'Consensus Halted' | 'RPC Unavailable' | 'Test Completed'
    
    this.config = {
      txType: "mixed", // 'c99_transfer' | 'evm_transfer' | 'contract_call' | 'staking_delegation' | 'mixed'
      totalTransactions: 100,
      targetTps: 15,
      concurrency: 15,
      durationSeconds: 30,
      rampUpSeconds: 5,
      walletCount: 3,
      rpcUrl: DEFAULT_RPC,
      cometRpcUrl: DEFAULT_COMET_RPC,
      contractAddress: "0x5051Fda09Db8FfF86fb9BA6bE1486f368782B916",
    };

    // Metrics Counters
    this.metrics = {
      submitted: 0,
      included: 0,
      successful: 0,
      failed: 0,
      pending: 0,
      currentTps: 0,
      peakTps: 0,
      averageLatency: 0,
      p95Latency: 0,
      maxLatency: 0,
      minLatency: 0,
      successRate: "100.0",
      
      // Blockchain Status
      currentBlockHeight: 0,
      startBlockHeight: 0,
      blockProductionStatus: "PRODUCING",
      averageBlockTime: 1.4,
      latestBlockTimestamp: null,
      latestBlockHash: "",
      totalVotingPower: 50500,
      onlineValidatorCount: 4,
      onlineVotingPowerRatio: "100.0%",
      consensusStatus: "Active BFT Finality",
      mempoolCount: 0,
      rpcHealth: "Reachable",
      rpcLatencyMs: 0,

      // Performance Status
      cpuUsagePercent: 0,
      memoryUsageMb: 0,
      systemMemoryTotalGb: (os.totalmem() / 1e9).toFixed(1),
      systemMemoryFreeGb: (os.freemem() / 1e9).toFixed(1),
      networkBytesSent: 0,
      networkBytesReceived: 0,
      diskUsageMb: 0,
      dbGrowthBytesPerTx: 0,
      dbWriteRateKbSec: 0,
    };

    // Test Wallets Pool
    this.wallets = [];
    this.funderWallet = null;
    this.provider = null;

    // In-Flight and Latency Tracking
    this.pendingTxs = new Map(); // hash -> TxRecord
    this.recentTxs = []; // last 50 transactions for live feed
    this.latencies = []; // sorted array of confirmed latencies
    this.timeSeries = []; // rolling 60 points of live graph data
    this.incidents = []; // chain failure detection log
    this.errors = new Map(); // error message -> count

    this.validatorNodes = [];

    // Internal loop handles
    this.workerInterval = null;
    this.pollerInterval = null;
    this.telemetryInterval = null;
    this.startTime = 0;
    this.endTime = 0;
    this.lastSecondCommitted = 0;
    this.lastSecondSubmitted = 0;
    this.lastDiskSize = 0;
    this.initialDiskSize = 0;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = Date.now();
    this.lastBlockSeenHeight = 0;
    this.lastBlockSeenTime = Date.now();
    this.consecutiveStalls = 0;
    this.reportedFinalReport = null;

    // Read latest contract address from public/latest_contract.json if present
    this.syncStorageContractAddress();
  }

  syncStorageContractAddress() {
    try {
      const p = path.resolve(process.cwd(), "public/latest_contract.json");
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
        if (raw?.address) {
          this.config.contractAddress = raw.address;
        }
      }
    } catch {
      // fallback to hardcoded default
    }
  }

  async ensureHealthyProvider() {
    const candidateUrls = [
      this.config.rpcUrl,
      "http://127.0.0.1:8545",
      "http://127.0.0.1:8555",
      "http://127.0.0.1:8565",
      "http://127.0.0.1:8575",
    ];

    try {
      if (this.provider) {
        await this.provider.getBlockNumber();
        return this.provider;
      }
    } catch {}

    for (const url of candidateUrls) {
      try {
        const testP = new ethers.JsonRpcProvider(url);
        await testP.getBlockNumber();
        this.provider = testP;
        this.config.rpcUrl = url;
        if (this.funderWallet) {
          this.funderWallet = new ethers.Wallet(DEPLOYER_PK, this.provider);
        }
        this.wallets.forEach((wObj) => {
          wObj.wallet = new ethers.Wallet(wObj.wallet.privateKey, this.provider);
        });
        return this.provider;
      } catch {}
    }
    return this.provider;
  }

  // ── Wallet Pool Initialization ───────────────────────────────────────────────
  async initWallets() {
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.funderWallet = new ethers.Wallet(DEPLOYER_PK, this.provider);

    const count = Math.min(Math.max(1, this.config.walletCount), 10);
    this.wallets = [];

    for (let i = 0; i < count; i++) {
      const seed = `chain99-stress-wallet-key-${i}`;
      const pk = ethers.keccak256(ethers.toUtf8Bytes(seed));
      const w = new ethers.Wallet(pk, this.provider);
      
      // Query on-chain balance and pending nonce
      let balance = 0n;
      let nonce = 0;
      try {
        [balance, nonce] = await Promise.all([
          this.provider.getBalance(w.address),
          this.provider.getTransactionCount(w.address, "pending"),
        ]);
      } catch {
        nonce = 0;
      }

      // If test wallet has < 10 C99, fund it with 50 C99 from deployer account
      if (balance < ethers.parseEther("10")) {
        try {
          const fundTx = await this.funderWallet.sendTransaction({
            to: w.address,
            value: ethers.parseEther("50"),
          });
          await fundTx.wait(1);
          nonce = await this.provider.getTransactionCount(w.address, "pending");
        } catch (e) {
          console.warn(`Wallet ${i} funding skipped/failed:`, e.message);
        }
      }

      this.wallets.push({
        index: i,
        wallet: w,
        address: w.address,
        currentNonce: nonce,
        activeInFlight: 0,
      });
    }
  }

  // ── Start Stress Test ────────────────────────────────────────────────────────
  async start(newConfig = {}) {
    if (this.status === "running") {
      throw new Error("A stress test is already actively running.");
    }

    // 1. Validate Configuration
    const validated = {
      txType: ["c99_transfer", "evm_transfer", "contract_call", "staking_delegation", "mixed"].includes(newConfig.txType)
        ? newConfig.txType
        : "mixed",
      totalTransactions: Math.min(Math.max(5, parseInt(newConfig.totalTransactions || 100, 10)), 3000),
      targetTps: Math.min(Math.max(1, parseInt(newConfig.targetTps || 15, 10)), 100),
      concurrency: Math.min(Math.max(1, parseInt(newConfig.concurrency || 15, 10)), 50),
      durationSeconds: Math.min(Math.max(5, parseInt(newConfig.durationSeconds || 30, 10)), 300),
      rampUpSeconds: Math.min(Math.max(0, parseInt(newConfig.rampUpSeconds || 5, 10)), 60),
      walletCount: Math.min(Math.max(1, parseInt(newConfig.walletCount || 3, 10)), 10),
      rpcUrl: newConfig.rpcUrl || DEFAULT_RPC,
      cometRpcUrl: newConfig.cometRpcUrl || DEFAULT_COMET_RPC,
      contractAddress: newConfig.contractAddress || this.config.contractAddress,
    };

    // 2. Connectivity Pre-check
    const testProvider = new ethers.JsonRpcProvider(validated.rpcUrl);
    let startBlock = 0;
    try {
      startBlock = await testProvider.getBlockNumber();
    } catch (err) {
      throw new Error(`Target Chain99 node unreachable at ${validated.rpcUrl}: ${err.message}`);
    }

    // Update state
    this.config = validated;
    this.status = "running";
    this.healthStatus = "Healthy";
    this.startTime = Date.now();
    this.endTime = 0;
    this.reportedFinalReport = null;

    // Reset Metrics
    this.metrics.submitted = 0;
    this.metrics.included = 0;
    this.metrics.successful = 0;
    this.metrics.failed = 0;
    this.metrics.pending = 0;
    this.metrics.currentTps = 0;
    this.metrics.peakTps = 0;
    this.metrics.averageLatency = 0;
    this.metrics.p95Latency = 0;
    this.metrics.maxLatency = 0;
    this.metrics.minLatency = 0;
    this.metrics.successRate = "100.0";
    this.metrics.startBlockHeight = startBlock;
    this.metrics.currentBlockHeight = startBlock;
    this.lastBlockSeenHeight = startBlock;
    this.lastBlockSeenTime = Date.now();
    this.lastSecondCommitted = 0;
    this.lastSecondSubmitted = 0;

    this.pendingTxs.clear();
    this.recentTxs = [];
    this.latencies = [];
    this.timeSeries = [];
    this.incidents = [];
    this.errors.clear();

    // 3. Initialize Wallets & Disk size baseline
    await this.initWallets();
    this.initialDiskSize = this.getNodesDiskSize();
    this.lastDiskSize = this.initialDiskSize;

    // 4. Start Telemetry Loop (every 800ms)
    this.telemetryInterval = setInterval(() => this.collectTelemetry(), 800);

    // 5. Start Receipt Poller Loop (every 300ms)
    this.pollerInterval = setInterval(() => this.pollReceipts(), 300);

    // 6. Start Workload Generator Loop
    this.runGenerationLoop();

    return {
      success: true,
      status: this.status,
      startBlock,
      walletsConfigured: this.wallets.length,
      config: this.config,
    };
  }

  // ── Workload Generation Loop ─────────────────────────────────────────────────
  async runGenerationLoop() {
    let walletIdx = 0;

    const dispatchNext = async () => {
      if (this.status !== "running") return;

      const elapsedSec = (Date.now() - this.startTime) / 1000;

      // Check Termination Criteria
      if (
        this.metrics.submitted >= this.config.totalTransactions ||
        elapsedSec >= this.config.durationSeconds
      ) {
        this.status = "stopping";
        this.checkCompletion();
        return;
      }

      // Concurrency check
      if (this.pendingTxs.size >= this.config.concurrency) {
        setTimeout(dispatchNext, 50);
        return;
      }

      // Calculate instantaneous target TPS with Ramp-Up
      let currentRate = this.config.targetTps;
      if (this.config.rampUpSeconds > 0 && elapsedSec < this.config.rampUpSeconds) {
        const rampFraction = elapsedSec / this.config.rampUpSeconds;
        currentRate = Math.max(1, Math.round(this.config.targetTps * (0.2 + 0.8 * rampFraction)));
      }

      // Select next wallet
      const wObj = this.wallets[walletIdx % this.wallets.length];
      walletIdx++;

      // Dispatch single transaction asynchronously
      this.dispatchTransaction(wObj).catch((e) => {
        console.warn("Tx dispatch exception:", e.message);
      });

      // Schedule next dispatch based on current rate
      const delayMs = Math.max(10, Math.floor(1000 / currentRate));
      setTimeout(dispatchNext, delayMs);
    };

    dispatchNext();
  }

  // ── Dispatch Single Transaction ──────────────────────────────────────────────
  async dispatchTransaction(wObj) {
    if (this.status !== "running") return;

    const txIndex = this.metrics.submitted + 1;
    this.metrics.submitted++;
    this.metrics.pending++;
    this.lastSecondSubmitted++;

    const txType = this.resolveTxType(this.config.txType, txIndex);
    const nonce = wObj.currentNonce++;
    const submitTime = Date.now();

    const txPayload = {
      nonce,
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      maxFeePerGas: ethers.parseUnits("3", "gwei"),
    };

    try {
      if (txType === "c99_transfer" || txType === "evm_transfer") {
        // Send transfer to circular test wallet or burn address
        const nextWallet = this.wallets[(wObj.index + 1) % this.wallets.length];
        txPayload.to = nextWallet.address;
        txPayload.value = ethers.parseUnits("1", "gwei"); // 0.000000001 C99
        txPayload.gasLimit = 21000n;
      } else if (txType === "contract_call") {
        // Mutate state in Storage.sol: set(txIndex)
        const iface = new ethers.Interface(STORAGE_ABI);
        txPayload.to = this.config.contractAddress;
        txPayload.data = iface.encodeFunctionData("set", [BigInt(txIndex)]);
        txPayload.gasLimit = 60000n;
      } else if (txType === "staking_delegation") {
        // Call EVM Staking Precompile 0x800: delegate(wObj.address, validator, 1 C99)
        const targetVal = KNOWN_VALIDATORS[txIndex % KNOWN_VALIDATORS.length];
        const iface = new ethers.Interface(STAKING_ABI);
        txPayload.to = STAKING_PRECOMPILE;
        txPayload.data = iface.encodeFunctionData("delegate", [
          wObj.address,
          targetVal,
          ethers.parseEther("0.1"), // 0.1 C99
        ]);
        txPayload.gasLimit = 350000n;
      }

      // Track bytes sent
      this.metrics.networkBytesSent += 250;

      // Submit raw transaction
      const tx = await wObj.wallet.sendTransaction(txPayload);
      const hash = tx.hash;

      const record = {
        hash,
        type: txType,
        walletIndex: wObj.index,
        from: wObj.address,
        to: txPayload.to,
        nonce,
        submitTime,
        status: "pending", // 'pending' | 'mined' | 'failed'
        blockNumber: null,
        latencyMs: null,
        gasUsed: null,
        error: null,
      };

      this.pendingTxs.set(hash, record);
      this.recentTxs.unshift(record);
      if (this.recentTxs.length > 50) this.recentTxs.pop();
    } catch (err) {
      // Submission rejected at RPC mempool ingestion
      this.metrics.failed++;
      this.metrics.pending = Math.max(0, this.metrics.pending - 1);

      const errMsg = err.message || "RPC submission rejected";
      this.recordError(errMsg);

      // Re-sync wallet nonce if gap or replay error
      if (errMsg.includes("nonce") || errMsg.includes("replacement")) {
        try {
          wObj.currentNonce = await this.provider.getTransactionCount(wObj.address, "pending");
        } catch {}
      }

      const failedRecord = {
        hash: `failed-${Date.now()}-${txIndex}`,
        type: txType,
        walletIndex: wObj.index,
        from: wObj.address,
        to: txPayload.to || "0x",
        nonce,
        submitTime,
        status: "failed",
        blockNumber: null,
        latencyMs: Date.now() - submitTime,
        gasUsed: "0",
        error: errMsg,
      };
      this.recentTxs.unshift(failedRecord);
      if (this.recentTxs.length > 50) this.recentTxs.pop();
    }
  }

  resolveTxType(configType, index) {
    if (configType !== "mixed") return configType;
    // 50% transfers, 30% contract calls, 20% staking delegations
    const mod = index % 10;
    if (mod < 5) return "c99_transfer";
    if (mod < 8) return "contract_call";
    return "staking_delegation";
  }

  // ── Poll In-Flight Receipts ──────────────────────────────────────────────────
  async pollReceipts() {
    if (this.pendingTxs.size === 0) {
      if (this.status === "stopping") {
        this.checkCompletion();
      }
      return;
    }

    const hashes = Array.from(this.pendingTxs.keys()).slice(0, 30);
    const now = Date.now();

    for (const hash of hashes) {
      const record = this.pendingTxs.get(hash);
      if (!record) continue;

      // Handle timeout (> 30s in flight)
      if (now - record.submitTime > 30000) {
        record.status = "failed";
        record.error = "Transaction confirmation timeout (>30s)";
        record.latencyMs = 30000;
        this.metrics.failed++;
        this.metrics.pending = Math.max(0, this.metrics.pending - 1);
        this.pendingTxs.delete(hash);
        this.recordError(record.error);
        continue;
      }

      try {
        const receipt = await this.provider.getTransactionReceipt(hash);
        this.metrics.networkBytesReceived += 300;

        if (receipt && receipt.blockNumber) {
          const latency = Math.max(10, Date.now() - record.submitTime);
          record.status = receipt.status === 1 ? "mined" : "failed";
          record.blockNumber = receipt.blockNumber;
          record.latencyMs = latency;
          record.gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : "21000";

          this.metrics.included++;
          this.metrics.pending = Math.max(0, this.metrics.pending - 1);
          this.lastSecondCommitted++;

          if (receipt.status === 1) {
            this.metrics.successful++;
          } else {
            this.metrics.failed++;
            record.error = "Transaction reverted on-chain (status 0x0)";
            this.recordError(record.error);
          }

          // Register latency
          this.latencies.push(latency);
          this.updateLatencyMetrics();

          this.pendingTxs.delete(hash);
        }
      } catch {
        // Ignore transient RPC error during receipt poll
      }
    }

    if (this.status === "stopping") {
      this.checkCompletion();
    }
  }

  updateLatencyMetrics() {
    if (this.latencies.length === 0) return;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    this.metrics.averageLatency = Math.round(sum / sorted.length);
    this.metrics.p95Latency = Math.round(sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]);
    this.metrics.minLatency = sorted[0];
    this.metrics.maxLatency = sorted[sorted.length - 1];

    const totalResolved = this.metrics.successful + this.metrics.failed;
    this.metrics.successRate = totalResolved > 0
      ? ((this.metrics.successful / totalResolved) * 100).toFixed(1)
      : "100.0";
  }

  recordError(msg) {
    const cleanMsg = (msg || "Unknown error").split("\n")[0].substring(0, 100);
    const curr = this.errors.get(cleanMsg) || 0;
    this.errors.set(cleanMsg, curr + 1);
  }

  // ── Collect Telemetry & Failure Detection ────────────────────────────────────
  async collectTelemetry() {
    const startRpc = performance.now();
    let rpcOk = false;

    // 1. Query EVM block number
    try {
      let blockNum;
      try {
        blockNum = await this.provider.getBlockNumber();
      } catch {
        const healthyP = await this.ensureHealthyProvider();
        blockNum = await healthyP.getBlockNumber();
      }
      this.metrics.currentBlockHeight = blockNum;
      this.metrics.rpcLatencyMs = Math.round(performance.now() - startRpc);
      this.metrics.rpcHealth = "Reachable";
      rpcOk = true;

      // Check block production progression
      if (blockNum > this.lastBlockSeenHeight) {
        const delta = (Date.now() - this.lastBlockSeenTime) / 1000;
        this.metrics.averageBlockTime = parseFloat(delta.toFixed(2));
        this.lastBlockSeenHeight = blockNum;
        this.lastBlockSeenTime = Date.now();
        this.consecutiveStalls = 0;
        this.metrics.blockProductionStatus = "PRODUCING";
      } else {
        const stalledSec = (Date.now() - this.lastBlockSeenTime) / 1000;
        if (stalledSec > 8) {
          this.metrics.blockProductionStatus = "HALTED";
          this.consecutiveStalls++;
        } else if (stalledSec > 4) {
          this.metrics.blockProductionStatus = "STALLED";
        }
      }

      // Fetch latest block header for timestamp & hash
      const latestBlock = await this.provider.getBlock(blockNum);
      if (latestBlock) {
        this.metrics.latestBlockHash = latestBlock.hash;
        this.metrics.latestBlockTimestamp = new Date(Number(latestBlock.timestamp) * 1000).toLocaleTimeString();
      }
    } catch (err) {
      this.metrics.rpcHealth = "Unreachable";
      this.metrics.rpcLatencyMs = -1;
      this.triggerIncident("RPC Endpoint Unreachable", `EVM RPC error: ${err.message}`);
    }

    // 2. Query CometBFT /status & /num_unconfirmed_txs
    try {
      const cometUrl = this.config.cometRpcUrl;
      const [statusRes, mempoolRes] = await Promise.all([
        fetch(`${cometUrl}/status`, { cache: "no-store", signal: AbortSignal.timeout(2000) })
          .then((r) => r.json())
          .catch(() => null),
        fetch(`${cometUrl}/num_unconfirmed_txs`, { cache: "no-store", signal: AbortSignal.timeout(2000) })
          .then((r) => r.json())
          .catch(() => null),
      ]);

      if (statusRes?.result?.sync_info) {
        const sync = statusRes.result.sync_info;
        this.metrics.consensusStatus = sync.catching_up ? "Catching Up" : "Active BFT Finality";
      }

      if (mempoolRes?.result) {
        this.metrics.mempoolCount = parseInt(mempoolRes.result.n_txs || "0", 10);
      }
    } catch {
      // fallback
    }

    // 3. Query Validator Nodes Status & Voting Power
    try {
      const nodeStatuses = await getNodeStatuses();
      this.validatorNodes = nodeStatuses;

      const onlineNodes = nodeStatuses.filter((n) => n.isOnline);
      const offlineNodes = nodeStatuses.filter((n) => !n.isOnline);

      this.metrics.onlineValidatorCount = onlineNodes.length;
      const totalPower = onlineNodes.reduce((acc, v) => acc + (v.votingPower || 0), 0);
      this.metrics.totalVotingPower = totalPower;

      const expectedPower = 50505;
      const powerRatio = (totalPower / expectedPower) * 100;
      this.metrics.onlineVotingPowerRatio = `${powerRatio.toFixed(1)}%`;

      if (powerRatio < 66.7) {
        this.triggerIncident(
          "Consensus Quorum Lost (<66.7%)",
          `Active voting power ${totalPower.toLocaleString()} (${powerRatio.toFixed(1)}%) is below 2/3 BFT quorum. Consensus will pause safely.`
        );
      } else if (offlineNodes.length > 0) {
        const offNames = offlineNodes.map((n) => n.moniker).join(", ");
        this.triggerIncident(
          `Validator Offline (${offNames})`,
          `${offlineNodes.length} validator(s) offline. Quorum intact at ${powerRatio.toFixed(1)}% (>66.7%). BFT consensus progressing.`
        );
      }
    } catch {
      // fallback
    }

    // 4. Measure System & Disk Metrics
    this.collectHardwareMetrics();

    // 5. Evaluate Failure Detection Rules & Determine Health Status
    this.evaluateHealthRules(rpcOk);

    // 6. Record 1-Second Chart Snapshot
    this.recordTimeSeriesSnapshot();
  }

  collectHardwareMetrics() {
    // Process CPU % calculation
    const currentCpu = process.cpuUsage();
    const now = Date.now();
    const timeDelta = (now - this.lastCpuTime) * 1000; // in microseconds
    if (timeDelta > 0) {
      const userDelta = currentCpu.user - this.lastCpuUsage.user;
      const sysDelta = currentCpu.system - this.lastCpuUsage.system;
      const cpuPercent = ((userDelta + sysDelta) / timeDelta) * 100;
      this.metrics.cpuUsagePercent = Math.min(100, parseFloat(cpuPercent.toFixed(1)));
    }
    this.lastCpuUsage = currentCpu;
    this.lastCpuTime = now;

    // Process Memory
    const mem = process.memoryUsage();
    this.metrics.memoryUsageMb = Math.round(mem.rss / (1024 * 1024));
    this.metrics.systemMemoryFreeGb = (os.freemem() / 1e9).toFixed(1);

    // LevelDB Disk Size
    const currentDisk = this.getNodesDiskSize();
    this.metrics.diskUsageMb = parseFloat((currentDisk / (1024 * 1024)).toFixed(2));

    const totalIncluded = this.metrics.included;
    if (totalIncluded > 0 && currentDisk > this.initialDiskSize) {
      const growthBytes = currentDisk - this.initialDiskSize;
      this.metrics.dbGrowthBytesPerTx = Math.round(growthBytes / totalIncluded);

      const elapsedSec = (Date.now() - this.startTime) / 1000;
      if (elapsedSec > 0) {
        this.metrics.dbWriteRateKbSec = parseFloat((growthBytes / 1024 / elapsedSec).toFixed(2));
      }
    }
  }

  getNodesDiskSize() {
    try {
      const segments = [process.cwd(), "..", "data", "node1", "data"];
      const node1Data = segments.join(path.sep);
      if (fs.existsSync(node1Data)) {
        return getDirectorySize(node1Data);
      }
    } catch {}
    return 0;
  }

  evaluateHealthRules(rpcOk) {
    if (!rpcOk) {
      this.healthStatus = "RPC Unavailable";
      return;
    }

    if (this.metrics.blockProductionStatus === "HALTED" || this.consecutiveStalls >= 3) {
      this.healthStatus = "Consensus Halted";
      this.triggerIncident(
        "Consensus Halt Detected",
        `Block height #${this.metrics.currentBlockHeight} has not advanced for >8 seconds`
      );
      return;
    }

    // High failure rate (> 10%)
    const resolved = this.metrics.included + this.metrics.failed;
    const failureRate = resolved > 10 ? (this.metrics.failed / resolved) * 100 : 0;

    // Latency degradation (> 4s)
    const isLatencySpike = this.metrics.averageLatency > 4000;

    // Mempool runaway (> 40)
    const isMempoolRunaway = this.metrics.mempoolCount > 40;

    if (failureRate > 10) {
      this.healthStatus = "Degraded";
      this.triggerIncident(
        "Elevated Transaction Failures",
        `Failure rate reached ${failureRate.toFixed(1)}%`
      );
    } else if (this.metrics.blockProductionStatus === "STALLED" || isLatencySpike || isMempoolRunaway) {
      this.healthStatus = "Under Load";
    } else {
      this.healthStatus = this.status === "completed" ? "Test Completed" : "Healthy";
    }
  }

  triggerIncident(title, details) {
    // Prevent duplicate spam of identical incident within 5 seconds
    const last = this.incidents[0];
    if (last && last.title === title && Date.now() - last.timestampRaw < 5000) {
      return;
    }

    const incident = {
      id: `inc-${Date.now()}`,
      title,
      details,
      timestamp: new Date().toLocaleTimeString(),
      timestampRaw: Date.now(),
      blockHeight: this.metrics.currentBlockHeight,
      tpsAtFailure: this.metrics.currentTps,
      pendingCount: this.metrics.pending,
      onlineVotingPowerRatio: this.metrics.onlineVotingPowerRatio,
      recovered: false,
    };

    this.incidents.unshift(incident);
    if (this.incidents.length > 20) this.incidents.pop();
  }

  recordTimeSeriesSnapshot() {
    // Current rolling 1-second TPS
    const commTps = this.lastSecondCommitted;
    const subTps = this.lastSecondSubmitted;
    this.metrics.currentTps = commTps;
    if (commTps > this.metrics.peakTps) {
      this.metrics.peakTps = commTps;
    }
    this.lastSecondCommitted = 0;
    this.lastSecondSubmitted = 0;

    // Mark previous incidents as recovered if chain is healthy again
    if (this.healthStatus === "Healthy" || this.healthStatus === "Under Load") {
      this.incidents.forEach((inc) => {
        if (!inc.recovered && Date.now() - inc.timestampRaw > 3000) {
          inc.recovered = true;
          inc.recoveryTime = new Date().toLocaleTimeString();
        }
      });
    }

    const snapshot = {
      time: new Date().toLocaleTimeString(),
      seconds: Math.round((Date.now() - (this.startTime || Date.now())) / 1000),
      submittedTps: subTps,
      committedTps: commTps,
      avgLatency: this.metrics.averageLatency,
      p95Latency: this.metrics.p95Latency,
      blockHeight: this.metrics.currentBlockHeight,
      mempoolSize: this.metrics.mempoolCount,
      cpuPercent: this.metrics.cpuUsagePercent,
      memoryMb: this.metrics.memoryUsageMb,
      successful: this.metrics.successful,
      failed: this.metrics.failed,
    };

    this.timeSeries.push(snapshot);
    if (this.timeSeries.length > 60) {
      this.timeSeries.shift();
    }
  }

  // ── Pause, Resume, Stop, Reset ───────────────────────────────────────────────
  pause() {
    if (this.status !== "running") return;
    this.status = "paused";
  }

  resume() {
    if (this.status !== "paused") return;
    this.status = "running";
    this.runGenerationLoop();
  }

  stop() {
    if (this.status !== "running" && this.status !== "paused") return;
    this.status = "stopping";
    // Allow pending transactions up to 5 seconds to settle
    setTimeout(() => {
      this.checkCompletion(true);
    }, 5000);
  }

  checkCompletion(force = false) {
    if (this.pendingTxs.size === 0 || force) {
      this.status = "completed";
      this.healthStatus = "Test Completed";
      this.endTime = Date.now();

      // Clear generation & telemetry intervals
      if (this.workerInterval) clearInterval(this.workerInterval);
      if (this.pollerInterval) clearInterval(this.pollerInterval);
      if (this.telemetryInterval) clearInterval(this.telemetryInterval);

      this.generateFinalReport();
    }
  }

  reset() {
    if (this.status === "running" || this.status === "paused") {
      this.stop();
    }
    this.status = "idle";
    this.healthStatus = "Healthy";
    this.metrics.submitted = 0;
    this.metrics.included = 0;
    this.metrics.successful = 0;
    this.metrics.failed = 0;
    this.metrics.pending = 0;
    this.metrics.currentTps = 0;
    this.metrics.peakTps = 0;
    this.pendingTxs.clear();
    this.recentTxs = [];
    this.latencies = [];
    this.timeSeries = [];
    this.incidents = [];
    this.errors.clear();
    this.reportedFinalReport = null;
  }

  // ── Generate Benchmark Final Report ──────────────────────────────────────────
  generateFinalReport() {
    const durationSec = Math.max(1, Math.round(((this.endTime || Date.now()) - this.startTime) / 1000));
    const totalAttempted = this.metrics.submitted;
    const totalCommitted = this.metrics.included;
    const totalFailed = this.metrics.failed;
    const avgTps = parseFloat((totalCommitted / durationSec).toFixed(2));
    const peakTps = this.metrics.peakTps;

    let overallResult = "PASSED - BFT RESILIENT";
    if (totalFailed > 0.1 * totalAttempted) {
      overallResult = "FAILED - HIGH ERROR RATE";
    } else if (this.incidents.some((i) => i.title.includes("Halt"))) {
      overallResult = "FAILED - CONSENSUS HALT";
    } else if (this.incidents.length > 0) {
      overallResult = "PASSED - DEGRADED UNDER PEAK LOAD";
    }

    const errorsObj = {};
    for (const [k, v] of this.errors.entries()) {
      errorsObj[k] = v;
    }

    this.reportedFinalReport = {
      testTimestamp: new Date().toISOString(),
      durationSeconds: durationSec,
      configUsed: { ...this.config },
      totalTransactionsAttempted: totalAttempted,
      totalTransactionsCommitted: totalCommitted,
      totalFailedTransactions: totalFailed,
      successRatePercent: this.metrics.successRate,
      averageTps: avgTps,
      peakTps: peakTps,
      maxSustainableTps: Math.min(peakTps, Math.round(avgTps * 1.2)),
      latencyMs: {
        min: this.metrics.minLatency,
        avg: this.metrics.averageLatency,
        p95: this.metrics.p95Latency,
        max: this.metrics.maxLatency,
      },
      blockProduction: {
        startBlock: this.metrics.startBlockHeight,
        endBlock: this.metrics.currentBlockHeight,
        blocksProduced: Math.max(0, this.metrics.currentBlockHeight - this.metrics.startBlockHeight),
        averageBlockTimeSeconds: this.metrics.averageBlockTime,
      },
      consensusPerformance: {
        activeValidators: this.metrics.onlineValidatorCount,
        totalVotingPower: this.metrics.totalVotingPower,
        interruptionsCount: this.incidents.length,
      },
      hardwareImpact: {
        finalMemoryMb: this.metrics.memoryUsageMb,
        finalDiskMb: this.metrics.diskUsageMb,
        dbStateGrowthBytesPerTx: this.metrics.dbGrowthBytesPerTx,
      },
      errorBreakdown: errorsObj,
      incidentsLogged: this.incidents,
      overallResult,
    };

    return this.reportedFinalReport;
  }

  // ── CSV & JSON Export ────────────────────────────────────────────────────────
  exportData(format = "json") {
    if (!this.reportedFinalReport) {
      this.generateFinalReport();
    }

    if (format === "json") {
      return JSON.stringify(this.reportedFinalReport, null, 2);
    }

    // CSV format
    const r = this.reportedFinalReport;
    const rows = [
      ["Metric", "Value"],
      ["Test Timestamp", r.testTimestamp],
      ["Duration (Seconds)", r.durationSeconds],
      ["Tx Type", r.configUsed.txType],
      ["Total Attempted", r.totalTransactionsAttempted],
      ["Total Committed", r.totalTransactionsCommitted],
      ["Total Failed", r.totalFailedTransactions],
      ["Success Rate (%)", r.successRatePercent],
      ["Average TPS", r.averageTps],
      ["Peak TPS", r.peakTps],
      ["Max Sustainable TPS", r.maxSustainableTps],
      ["Min Latency (ms)", r.latencyMs.min],
      ["Average Latency (ms)", r.latencyMs.avg],
      ["P95 Latency (ms)", r.latencyMs.p95],
      ["Max Latency (ms)", r.latencyMs.max],
      ["Start Block", r.blockProduction.startBlock],
      ["End Block", r.blockProduction.endBlock],
      ["Blocks Produced", r.blockProduction.blocksProduced],
      ["Average Block Time (s)", r.blockProduction.averageBlockTimeSeconds],
      ["Active Validators", r.consensusPerformance.activeValidators],
      ["Total Voting Power", r.consensusPerformance.totalVotingPower],
      ["Consensus Interruptions", r.consensusPerformance.interruptionsCount],
      ["LevelDB State Growth (bytes/tx)", r.hardwareImpact.dbStateGrowthBytesPerTx],
      ["Overall Result", r.overallResult],
    ];

    return rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  }

  // ── Snapshot for Dashboard ───────────────────────────────────────────────────
  getSnapshot() {
    return {
      status: this.status,
      healthStatus: this.healthStatus,
      elapsedSeconds: this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0,
      config: this.config,
      metrics: this.metrics,
      timeSeries: this.timeSeries,
      recentTxs: this.recentTxs.slice(0, 20),
      incidents: this.incidents.slice(0, 10),
      validatorNodes: this.validatorNodes || [],
      hasReport: !!this.reportedFinalReport,
      report: this.reportedFinalReport,
    };
  }
}

// ── Persistent Global Singleton ──────────────────────────────────────────────
if (!globalThis.__chain99StressEngine) {
  globalThis.__chain99StressEngine = new StressEngine();
}

export const stressEngine = globalThis.__chain99StressEngine;
