"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Download,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Cpu,
  Layers,
  Shield,
  HardDrive,
  Flame,
  ArrowLeft,
  Radio,
  FileText,
  X,
  Zap,
  Clock,
  Server,
  Database,
  BarChart2,
  Check,
  Power,
} from "lucide-react";

import "./stress-test.css";
import { ResponsiveSvgChart, SuccessDonutChart } from "./components/LiveCharts";

// ── Predefined Test Profiles ──────────────────────────────────────────────────
const PROFILES = [
  {
    id: "baseline",
    name: "Profile A — Baseline",
    badge: "Baseline",
    desc: "Low transaction volume to establish normal network performance baseline.",
    config: {
      txType: "mixed",
      totalTransactions: 30,
      targetTps: 3,
      concurrency: 5,
      durationSeconds: 20,
      rampUpSeconds: 0,
      walletCount: 2,
    },
    tag: "30 txs · 3 TPS · 2 Wallets",
  },
  {
    id: "sustained",
    name: "Profile B — Sustained Load",
    badge: "Sustained",
    desc: "Constant moderate transaction rate for a defined duration to verify block throughput.",
    config: {
      txType: "mixed",
      totalTransactions: 150,
      targetTps: 10,
      concurrency: 15,
      durationSeconds: 20,
      rampUpSeconds: 0,
      walletCount: 3,
    },
    tag: "150 txs · 10 TPS · 3 Wallets",
  },
  {
    id: "rampup",
    name: "Profile C — Ramp-Up",
    badge: "Ramp-Up",
    desc: "Gradually increase transaction rate from 20% to 100% to identify the network throughput threshold.",
    config: {
      txType: "mixed",
      totalTransactions: 200,
      targetTps: 20,
      concurrency: 20,
      durationSeconds: 25,
      rampUpSeconds: 8,
      walletCount: 3,
    },
    tag: "200 txs · 20 TPS peak · 8s ramp",
  },
  {
    id: "burst",
    name: "Profile D — Burst Load",
    badge: "Burst Load",
    desc: "Sudden high-velocity transaction spike to test mempool absorption and consensus recovery.",
    config: {
      txType: "mixed",
      totalTransactions: 100,
      targetTps: 25,
      concurrency: 30,
      durationSeconds: 8,
      rampUpSeconds: 0,
      walletCount: 4,
    },
    tag: "100 txs · 25 TPS burst · 4 Wallets",
  },
  {
    id: "max_throughput",
    name: "Profile E — Max Throughput",
    badge: "Peak Load",
    desc: "Progressive peak load to push CometBFT mempool and block gas limits toward saturation.",
    config: {
      txType: "mixed",
      totalTransactions: 300,
      targetTps: 40,
      concurrency: 40,
      durationSeconds: 20,
      rampUpSeconds: 5,
      walletCount: 5,
    },
    tag: "300 txs · 40 TPS · 5 Wallets",
  },
  {
    id: "recovery",
    name: "Profile F — Recovery Test",
    badge: "Recovery",
    desc: "High volume burst followed by transaction cessation to observe mempool drain and latency return.",
    config: {
      txType: "c99_transfer",
      totalTransactions: 80,
      targetTps: 20,
      concurrency: 20,
      durationSeconds: 10,
      rampUpSeconds: 0,
      walletCount: 3,
    },
    tag: "80 txs · 20 TPS · Drain observation",
  },
];

// RPC Endpoints presets
const RPC_PRESETS = [
  { name: "Node 1 (Primary EVM)", url: "http://127.0.0.1:8545", comet: "http://127.0.0.1:26657" },
  { name: "Node 2 (Validator B)", url: "http://127.0.0.1:8555", comet: "http://127.0.0.1:26667" },
  { name: "Node 3 (Validator C)", url: "http://127.0.0.1:8565", comet: "http://127.0.0.1:26677" },
  { name: "Node 4 (Validator D)", url: "http://127.0.0.1:8575", comet: "http://127.0.0.1:26687" },
];

export default function StressTestPage() {
  // Test State
  const [engineStatus, setEngineStatus] = useState("idle"); // 'idle' | 'running' | 'paused' | 'stopping' | 'completed' | 'error'
  const [healthStatus, setHealthStatus] = useState("Healthy");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Configuration Form State
  const [activeProfile, setActiveProfile] = useState("baseline");
  const [txType, setTxType] = useState("mixed");
  const [totalTransactions, setTotalTransactions] = useState(100);
  const [targetTps, setTargetTps] = useState(15);
  const [concurrency, setConcurrency] = useState(15);
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [rampUpSeconds, setRampUpSeconds] = useState(5);
  const [walletCount, setWalletCount] = useState(3);
  const [selectedRpcIndex, setSelectedRpcIndex] = useState(0);

  // Live Metrics & Telemetry
  const [metrics, setMetrics] = useState({
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
    cpuUsagePercent: 0,
    memoryUsageMb: 0,
    systemMemoryTotalGb: "16.0",
    systemMemoryFreeGb: "4.0",
    networkBytesSent: 0,
    networkBytesReceived: 0,
    diskUsageMb: 0,
    dbGrowthBytesPerTx: 0,
    dbWriteRateKbSec: 0,
  });

  const [timeSeries, setTimeSeries] = useState([]);
  const [recentTxs, setRecentTxs] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [report, setReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const [validatorNodes, setValidatorNodes] = useState([
    {
      id: "node1",
      name: "Validator A (Primary RPC)",
      moniker: "validatorA",
      operatorAddress: "c99valoper18v9ejkkqn83pm5gcdqkxgpjt02e2fef7wf2tn9",
      evmPort: 8545,
      cometPort: 26657,
      votingPower: 10500,
      votingPercent: 20.8,
      isOnline: true,
      isPrimaryRpc: true,
    },
    {
      id: "node2",
      name: "Validator B (Proposer Leader)",
      moniker: "validatorB",
      operatorAddress: "c99valoper1r9dck9unakj56yc6g6u0nmfn6pqz89l7n678q5",
      evmPort: 8555,
      cometPort: 26667,
      votingPower: 20000,
      votingPercent: 39.6,
      isOnline: true,
      isPrimaryRpc: false,
    },
    {
      id: "node3",
      name: "Validator C (Worker Node)",
      moniker: "validatorC",
      operatorAddress: "c99valoper1pq5suzunkygxhkxt5va9gk0zap677eee2knc0j",
      evmPort: 8565,
      cometPort: 26677,
      votingPower: 10000,
      votingPercent: 19.8,
      isOnline: true,
      isPrimaryRpc: false,
    },
    {
      id: "node4",
      name: "Validator D (Worker Node)",
      moniker: "validatorD",
      operatorAddress: "c99valoper12tmwmlw7n7c7zu7cgdluzandq95uwe5vl5cehh",
      evmPort: 8575,
      cometPort: 26687,
      votingPower: 10005,
      votingPercent: 19.8,
      isOnline: true,
      isPrimaryRpc: false,
    },
  ]);
  const [togglingNodeId, setTogglingNodeId] = useState(null);

  // ── Apply Predefined Profile ────────────────────────────────────────────────
  const applyProfile = (prof) => {
    setActiveProfile(prof.id);
    setTxType(prof.config.txType);
    setTotalTransactions(prof.config.totalTransactions);
    setTargetTps(prof.config.targetTps);
    setConcurrency(prof.config.concurrency);
    setDurationSeconds(prof.config.durationSeconds);
    setRampUpSeconds(prof.config.rampUpSeconds);
    setWalletCount(prof.config.walletCount);
  };

  // ── Sync with Backend Engine (SSE + Polling Fallback) ────────────────────────
  useEffect(() => {
    let eventSource = null;

    const setupSSE = () => {
      try {
        eventSource = new EventSource("/api/stress-test/stream");

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data) {
              setEngineStatus(data.status || "idle");
              setHealthStatus(data.healthStatus || "Healthy");
              setElapsedSeconds(data.elapsedSeconds || 0);
              if (data.metrics) setMetrics(data.metrics);
              if (data.timeSeries) setTimeSeries(data.timeSeries);
              if (data.recentTxs) setRecentTxs(data.recentTxs);
              if (data.incidents) setIncidents(data.incidents);
              if (data.validatorNodes && data.validatorNodes.length > 0) setValidatorNodes(data.validatorNodes);
              if (data.report) setReport(data.report);
            }
          } catch {
            // ignore JSON parse
          }
        };

        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
        };
      } catch {
        // SSE not supported or blocked
      }
    };

    setupSSE();

    // Polling fallback every 1200ms
    const fallbackPoll = setInterval(async () => {
      try {
        const res = await fetch("/api/stress-test", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setEngineStatus(data.status || "idle");
          setHealthStatus(data.healthStatus || "Healthy");
          setElapsedSeconds(data.elapsedSeconds || 0);
          if (data.metrics) setMetrics(data.metrics);
          if (data.timeSeries && data.timeSeries.length > 0) setTimeSeries(data.timeSeries);
          if (data.recentTxs) setRecentTxs(data.recentTxs);
          if (data.incidents) setIncidents(data.incidents);
          if (data.validatorNodes && data.validatorNodes.length > 0) setValidatorNodes(data.validatorNodes);
          if (data.report) setReport(data.report);
        }
      } catch {}
    }, 1200);

    // Initial query of validator node process statuses
    fetch("/api/validators/toggle")
      .then((r) => r.json())
      .then((d) => {
        if (d?.nodes) setValidatorNodes(d.nodes);
      })
      .catch(() => {});

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(fallbackPoll);
    };
  }, []);

  // ── Engine Action Handlers ──────────────────────────────────────────────────
  const requestStart = () => {
    // Check if configuration requires safety confirmation
    if (targetTps > 30 || totalTransactions > 500 || concurrency > 35) {
      setShowConfirmModal(true);
      return;
    }
    executeStart();
  };

  const executeStart = async () => {
    setShowConfirmModal(false);
    setLoadingAction(true);
    try {
      const selectedRpc = RPC_PRESETS[selectedRpcIndex] || RPC_PRESETS[0];
      const payload = {
        action: "start",
        config: {
          txType,
          totalTransactions: parseInt(totalTransactions, 10),
          targetTps: parseInt(targetTps, 10),
          concurrency: parseInt(concurrency, 10),
          durationSeconds: parseInt(durationSeconds, 10),
          rampUpSeconds: parseInt(rampUpSeconds, 10),
          walletCount: parseInt(walletCount, 10),
          rpcUrl: selectedRpc.url,
          cometRpcUrl: selectedRpc.comet,
        },
      };

      const res = await fetch("/api/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Failed to start test: ${data.error}`);
      } else {
        setEngineStatus("running");
      }
    } catch (err) {
      alert(`Error starting test: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePause = async () => {
    setLoadingAction(true);
    try {
      await fetch("/api/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      setEngineStatus("paused");
    } catch (e) {
      console.warn("Pause error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleResume = async () => {
    setLoadingAction(true);
    try {
      await fetch("/api/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      setEngineStatus("running");
    } catch (e) {
      console.warn("Resume error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStop = async () => {
    setLoadingAction(true);
    try {
      await fetch("/api/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      setEngineStatus("stopping");
    } catch (e) {
      console.warn("Stop error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReset = async () => {
    setLoadingAction(true);
    try {
      await fetch("/api/stress-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      setEngineStatus("idle");
      setTimeSeries([]);
      setRecentTxs([]);
      setIncidents([]);
      setReport(null);
    } catch (e) {
      console.warn("Reset error:", e);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleExport = (format) => {
    window.open(`/api/stress-test/export?format=${format}`, "_blank");
  };

  const toggleValidator = async (nodeId, action) => {
    setTogglingNodeId(nodeId);
    try {
      const res = await fetch("/api/validators/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId, action }),
      });
      const data = await res.json();
      if (data.success && data.nodes) {
        setValidatorNodes(data.nodes);
      } else if (!data.success) {
        alert(`Failed to ${action} validator: ${data.error}`);
      }
    } catch (err) {
      alert(`Error toggling validator: ${err.message}`);
    } finally {
      setTogglingNodeId(null);
    }
  };

  const restartAllValidators = async () => {
    setTogglingNodeId("all");
    try {
      for (const node of validatorNodes) {
        if (!node.isOnline) {
          await fetch("/api/validators/toggle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId: node.id, action: "start" }),
          });
        }
      }
      const res = await fetch("/api/validators/toggle");
      const data = await res.json();
      if (data?.nodes) setValidatorNodes(data.nodes);
    } catch (e) {
      console.warn("Restart all error:", e);
    } finally {
      setTogglingNodeId(null);
    }
  };

  // Progress calculation
  const progressPercent = Math.min(
    100,
    totalTransactions > 0 ? Math.round((metrics.submitted / totalTransactions) * 100) : 0
  );

  return (
    <div className="stress-page">
      {/* ── Top Main Navbar ────────────────────────────────────────── */}
      <header className="stress-navbar">
        <div className="brand-wrapper">
          <div className="brand-logo">99</div>
          <div className="brand-meta">
            <div className="brand-title">
              <span>Chain99 L1</span>
              <span className="badge-chain">Stress Engine</span>
            </div>
            <div className="brand-sub">CometBFT PoS & EVM Stress Testing Suite</div>
          </div>
        </div>

        <div className="nav-actions">
          <div className={`network-badge ${metrics.rpcHealth === "Reachable" ? "online" : "offline"}`}>
            <span className={`pulse-dot ${metrics.rpcHealth === "Reachable" ? "emerald" : "rose"}`} />
            <span>
              {metrics.rpcHealth === "Reachable"
                ? `Node Online (${metrics.rpcLatencyMs}ms) · Block #${metrics.currentBlockHeight || "--"}`
                : "RPC Offline"}
            </span>
          </div>

          <Link href="/" className="btn btn-secondary btn-sm">
            <ArrowLeft size={14} /> Explorer
          </Link>

          <Link href="/architecture" className="btn btn-secondary btn-sm">
            <Layers size={14} /> Architecture
          </Link>
        </div>
      </header>

      <div className="stress-container">
        {/* ── Hero Banner ────────────────────────────────────────────── */}
        <section className="stress-hero">
          <div className="stress-hero-badge">
            <Zap size={14} /> Production Proof-of-Stake Stress Test Bench
          </div>
          <h1 className="stress-title">Network Resilience & High-Throughput Monitor</h1>
          <p className="stress-subtitle">
            Inject deterministic EVM transactions, smart contract mutations, and precompile delegations
            into Chain99's CometBFT multi-validator consensus mesh. Monitor live TPS, deterministic 1-block
            finality, mempool buffering, and fault-tolerance in real time.
          </p>
        </section>

        {/* ── Health Status Banner ───────────────────────────────────── */}
        <div className={`health-banner ${healthStatus.replace(/\s+/g, "_")}`}>
          <div className="health-title-group">
            <div className="health-icon-box">
              {healthStatus === "Healthy" && "🟢"}
              {healthStatus === "Under Load" && "⚡"}
              {healthStatus === "Degraded" && "⚠️"}
              {healthStatus === "Consensus Halted" && "🚨"}
              {healthStatus === "RPC Unavailable" && "🔌"}
              {healthStatus === "Test Completed" && "🏁"}
            </div>
            <div>
              <div className="health-status-name">
                <span>Network Status: {healthStatus}</span>
                <span className={`badge-tag ${healthStatus === "Healthy" ? "recovered" : "danger"}`}>
                  {engineStatus.toUpperCase()}
                </span>
              </div>
              <div className="health-sub">
                {healthStatus === "Healthy" && "Consensus round advancing smoothly. No stalls or high error rates detected."}
                {healthStatus === "Under Load" && "Heavy transaction volume detected. Mempool buffering active; consensus processing normally."}
                {healthStatus === "Degraded" && "Block latency spike or failure rate elevated. Validator set remaining active."}
                {healthStatus === "Consensus Halted" && "CRITICAL: Block production ceased for >8s or 2/3 voting quorum unavailable."}
                {healthStatus === "RPC Unavailable" && "Target JSON-RPC endpoint did not respond to ping query."}
                {healthStatus === "Test Completed" && "Stress test run finished. Review benchmark metrics and export report."}
              </div>
            </div>
          </div>

          <div className="health-metrics-strip">
            <div className="health-metric-item">
              <div className="health-metric-label">Online Voting Power</div>
              <div className="health-metric-val">{metrics.onlineVotingPowerRatio}</div>
            </div>
            <div className="health-metric-item">
              <div className="health-metric-label">Mempool Backlog</div>
              <div className="health-metric-val">{metrics.mempoolCount} txs</div>
            </div>
            <div className="health-metric-item">
              <div className="health-metric-label">Block Time</div>
              <div className="health-metric-val">{metrics.averageBlockTime}s</div>
            </div>
          </div>
        </div>

        {/* ── Control Bar ────────────────────────────────────────────── */}
        <div className="control-bar">
          <div className="control-buttons">
            {engineStatus === "idle" || engineStatus === "completed" ? (
              <button
                className="btn btn-primary"
                onClick={requestStart}
                disabled={loadingAction}
              >
                <Play size={16} /> Start Test
              </button>
            ) : engineStatus === "running" ? (
              <button
                className="btn btn-warning"
                onClick={handlePause}
                disabled={loadingAction}
              >
                <Pause size={16} /> Pause Test
              </button>
            ) : engineStatus === "paused" ? (
              <button
                className="btn btn-primary"
                onClick={handleResume}
                disabled={loadingAction}
              >
                <Play size={16} /> Resume Test
              </button>
            ) : null}

            {(engineStatus === "running" || engineStatus === "paused") && (
              <button
                className="btn btn-danger"
                onClick={handleStop}
                disabled={loadingAction}
              >
                <Square size={16} /> Stop Test
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={loadingAction || engineStatus === "running"}
            >
              <RotateCcw size={16} /> Reset
            </button>

            {report && (
              <button
                className="btn btn-secondary"
                onClick={() => setShowReportModal(true)}
              >
                <FileText size={16} /> View Results
              </button>
            )}
          </div>

          <div className="control-status-panel">
            <div className="progress-group">
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#94a3b8", marginBottom: "4px" }}>
                <span>Dispatched: {metrics.submitted} / {totalTransactions}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className={`status-chip ${engineStatus}`}>
              <span>State: {engineStatus.toUpperCase()}</span>
              {engineStatus === "running" && <span className="pulse-dot emerald" />}
            </div>

            <div style={{ fontSize: "0.85rem", color: "#94a3b8", fontFamily: "var(--font-mono, monospace)" }}>
              ⏱️ {elapsedSeconds}s
            </div>
          </div>
        </div>

        {/* ── Predefined Scenarios (Profiles) ────────────────────────── */}
        <div style={{ marginBottom: "28px" }}>
          <div className="section-title">
            <BarChart2 size={20} color="#06b6d4" />
            <span>Predefined Stress Profiles</span>
          </div>
          <div className="section-desc">
            Select a tailored benchmark profile to automatically configure injection rates, concurrency, and target test wallets.
          </div>

          <div className="scenarios-grid">
            {PROFILES.map((prof) => (
              <div
                key={prof.id}
                className={`scenario-card ${activeProfile === prof.id ? "active" : ""}`}
                onClick={() => applyProfile(prof)}
              >
                <div className="scenario-header">
                  <span className="scenario-badge">{prof.badge}</span>
                  {activeProfile === prof.id && <Check size={14} color="#6366f1" />}
                </div>
                <div className="scenario-name">{prof.name}</div>
                <div className="scenario-details">{prof.desc}</div>
                <div className="scenario-meta">{prof.tag}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Configuration Form ─────────────────────────────────────── */}
        <div className="config-card">
          <div className="section-title" style={{ marginBottom: "16px" }}>
            <Server size={20} color="#6366f1" />
            <span>Stress Test Parameters</span>
          </div>

          <div className="form-grid">
            {/* Transaction Type */}
            <div className="form-group">
              <label className="form-label">
                <span>Transaction Workload Type</span>
              </label>
              <select
                className="form-select"
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
                disabled={engineStatus === "running"}
              >
                <option value="mixed">Mixed (50% Transfers, 30% Contract, 20% Staking)</option>
                <option value="c99_transfer">Native C99 Transfer (Simple Transfer)</option>
                <option value="evm_transfer">EVM Value Transfer</option>
                <option value="contract_call">Smart Contract Mutation (Storage.set)</option>
                <option value="staking_delegation">Staking Delegation (Precompile 0x800)</option>
              </select>
              <span className="form-hint">
                Mixed workload stresses EVM state trie, contract execution, and Cosmos staking.
              </span>
            </div>

            {/* Total Transactions */}
            <div className="form-group">
              <label className="form-label">
                <span>Total Transactions</span>
                <span className="form-hint">5 - 3,000</span>
              </label>
              <div className="range-with-input">
                <input
                  type="range"
                  min="5"
                  max="1000"
                  step="5"
                  className="range-input"
                  value={totalTransactions}
                  onChange={(e) => setTotalTransactions(Number(e.target.value))}
                  disabled={engineStatus === "running"}
                />
                <input
                  type="number"
                  min="5"
                  max="3000"
                  className="form-control range-num-box"
                  value={totalTransactions}
                  onChange={(e) => setTotalTransactions(Math.min(3000, Math.max(5, Number(e.target.value))))}
                  disabled={engineStatus === "running"}
                />
              </div>
            </div>

            {/* Target TPS */}
            <div className="form-group">
              <label className="form-label">
                <span>Target Transaction Rate (TPS)</span>
                <span className="form-hint">1 - 100 TPS</span>
              </label>
              <div className="range-with-input">
                <input
                  type="range"
                  min="1"
                  max="60"
                  className="range-input"
                  value={targetTps}
                  onChange={(e) => setTargetTps(Number(e.target.value))}
                  disabled={engineStatus === "running"}
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="form-control range-num-box"
                  value={targetTps}
                  onChange={(e) => setTargetTps(Math.min(100, Math.max(1, Number(e.target.value))))}
                  disabled={engineStatus === "running"}
                />
              </div>
            </div>

            {/* Concurrency */}
            <div className="form-group">
              <label className="form-label">
                <span>Concurrency (In-Flight Window)</span>
                <span className="form-hint">1 - 50</span>
              </label>
              <div className="range-with-input">
                <input
                  type="range"
                  min="1"
                  max="50"
                  className="range-input"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  disabled={engineStatus === "running"}
                />
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="form-control range-num-box"
                  value={concurrency}
                  onChange={(e) => setConcurrency(Math.min(50, Math.max(1, Number(e.target.value))))}
                  disabled={engineStatus === "running"}
                />
              </div>
            </div>

            {/* Duration */}
            <div className="form-group">
              <label className="form-label">
                <span>Test Duration (Seconds)</span>
                <span className="form-hint">5 - 300s</span>
              </label>
              <div className="range-with-input">
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  className="range-input"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Number(e.target.value))}
                  disabled={engineStatus === "running"}
                />
                <input
                  type="number"
                  min="5"
                  max="300"
                  className="form-control range-num-box"
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Math.min(300, Math.max(5, Number(e.target.value))))}
                  disabled={engineStatus === "running"}
                />
              </div>
            </div>

            {/* Ramp-Up */}
            <div className="form-group">
              <label className="form-label">
                <span>Ramp-Up Duration</span>
                <span className="form-hint">0 - 30s</span>
              </label>
              <div className="range-with-input">
                <input
                  type="range"
                  min="0"
                  max="30"
                  className="range-input"
                  value={rampUpSeconds}
                  onChange={(e) => setRampUpSeconds(Number(e.target.value))}
                  disabled={engineStatus === "running"}
                />
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="form-control range-num-box"
                  value={rampUpSeconds}
                  onChange={(e) => setRampUpSeconds(Math.min(60, Math.max(0, Number(e.target.value))))}
                  disabled={engineStatus === "running"}
                />
              </div>
            </div>

            {/* Wallets */}
            <div className="form-group">
              <label className="form-label">
                <span>Signer Test Wallets</span>
                <span className="form-hint">1 - 5 Accounts</span>
              </label>
              <div className="range-with-input">
                <input
                  type="range"
                  min="1"
                  max="5"
                  className="range-input"
                  value={walletCount}
                  onChange={(e) => setWalletCount(Number(e.target.value))}
                  disabled={engineStatus === "running"}
                />
                <input
                  type="number"
                  min="1"
                  max="5"
                  className="form-control range-num-box"
                  value={walletCount}
                  onChange={(e) => setWalletCount(Math.min(5, Math.max(1, Number(e.target.value))))}
                  disabled={engineStatus === "running"}
                />
              </div>
            </div>

            {/* Target RPC Endpoint */}
            <div className="form-group">
              <label className="form-label">
                <span>Target Node RPC Endpoint</span>
              </label>
              <select
                className="form-select"
                value={selectedRpcIndex}
                onChange={(e) => setSelectedRpcIndex(Number(e.target.value))}
                disabled={engineStatus === "running"}
              >
                {RPC_PRESETS.map((p, idx) => (
                  <option key={idx} value={idx}>
                    {p.name} — {p.url}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                Selects which validator receives the transactions. All 4 nodes validate via CometBFT P2P mesh.
              </span>
            </div>
          </div>
        </div>

        {/* ── Real-Time Chain Status Dashboard (KPIs) ────────────────── */}
        <section className="kpi-section">
          <div className="section-title">
            <Activity size={20} color="#10b981" />
            <span>Real-Time Chain Status Dashboard</span>
          </div>

          <div className="kpi-grid">
            {/* Submitted */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Submitted</span>
                <span>📤</span>
              </div>
              <div className="kpi-value" style={{ color: "#6366f1" }}>
                {metrics.submitted.toLocaleString()}
              </div>
              <div className="kpi-sub">Total Dispatched</div>
            </div>

            {/* Included */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Included in Blocks</span>
                <span>⛓️</span>
              </div>
              <div className="kpi-value" style={{ color: "#10b981" }}>
                {metrics.included.toLocaleString()}
              </div>
              <div className="kpi-sub">Confirmed on-chain</div>
            </div>

            {/* Pending */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Pending (In-Flight)</span>
                <span>⏳</span>
              </div>
              <div className="kpi-value" style={{ color: "#06b6d4" }}>
                {metrics.pending.toLocaleString()}
              </div>
              <div className="kpi-sub">Awaiting block commit</div>
            </div>

            {/* Failed */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Failed</span>
                <span>❌</span>
              </div>
              <div className="kpi-value" style={{ color: metrics.failed > 0 ? "#f43f5e" : "#64748b" }}>
                {metrics.failed.toLocaleString()}
              </div>
              <div className="kpi-sub">Success: {metrics.successRate}%</div>
            </div>

            {/* Current TPS */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Current TPS</span>
                <span>⚡</span>
              </div>
              <div className="kpi-value" style={{ color: "#06b6d4" }}>
                {metrics.currentTps}
              </div>
              <div className="kpi-sub">Peak: {metrics.peakTps} TPS</div>
            </div>

            {/* Latency (Avg & P95) */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Avg / P95 Latency</span>
                <span>⏱️</span>
              </div>
              <div className="kpi-value" style={{ color: "#f59e0b" }}>
                {metrics.averageLatency} <span style={{ fontSize: "1rem", color: "#94a3b8" }}>/ {metrics.p95Latency}ms</span>
              </div>
              <div className="kpi-sub">Commit finality duration</div>
            </div>

            {/* Block Height */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Block Height</span>
                <span>🧱</span>
              </div>
              <div className="kpi-value" style={{ color: "#fff" }}>
                #{metrics.currentBlockHeight || "--"}
              </div>
              <div className="kpi-sub">Interval: ~{metrics.averageBlockTime}s</div>
            </div>

            {/* Mempool Count */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Mempool Backlog</span>
                <span>📥</span>
              </div>
              <div className="kpi-value" style={{ color: metrics.mempoolCount > 25 ? "#f59e0b" : "#cbd5e1" }}>
                {metrics.mempoolCount}
              </div>
              <div className="kpi-sub">CometBFT unconfirmed</div>
            </div>

            {/* Online Validators */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Validators Online</span>
                <span>🛡️</span>
              </div>
              <div className="kpi-value" style={{ color: "#10b981" }}>
                {metrics.onlineValidatorCount} / 4
              </div>
              <div className="kpi-sub">Voting Power: {metrics.totalVotingPower.toLocaleString()}</div>
            </div>

            {/* CPU & RAM Usage */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>CPU / RAM Usage</span>
                <span>💻</span>
              </div>
              <div className="kpi-value" style={{ color: "#a5b4fc" }}>
                {metrics.cpuUsagePercent}% <span style={{ fontSize: "1rem", color: "#94a3b8" }}>/ {metrics.memoryUsageMb}MB</span>
              </div>
              <div className="kpi-sub">System Free: {metrics.systemMemoryFreeGb}GB</div>
            </div>

            {/* LevelDB Storage Footprint */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>Node 1 DB Disk</span>
                <span>💾</span>
              </div>
              <div className="kpi-value" style={{ color: "#fff" }}>
                {metrics.diskUsageMb > 0 ? `${metrics.diskUsageMb} MB` : "Unavailable"}
              </div>
              <div className="kpi-sub">
                {metrics.dbGrowthBytesPerTx > 0 ? `~${metrics.dbGrowthBytesPerTx} B/tx state` : "LevelDB Footprint"}
              </div>
            </div>

            {/* RPC Latency */}
            <div className="kpi-card">
              <div className="kpi-label">
                <span>RPC Latency</span>
                <span>📡</span>
              </div>
              <div className="kpi-value" style={{ color: "#34d399" }}>
                {metrics.rpcLatencyMs >= 0 ? `${metrics.rpcLatencyMs} ms` : "Offline"}
              </div>
              <div className="kpi-sub">{metrics.rpcHealth}</div>
            </div>
          </div>
        </section>

        {/* ── Live Visualizations (Charts Grid) ──────────────────────── */}
        <section style={{ marginBottom: "32px" }}>
          <div className="section-title">
            <BarChart2 size={20} color="#6366f1" />
            <span>Live Telemetry & Visualizations</span>
          </div>

          <div className="charts-grid">
            {/* Chart 1: TPS Over Time */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Zap size={16} color="#6366f1" />
                  <span>TPS Over Time</span>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#6366f1" }} />
                    <span>Submitted TPS</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#06b6d4" }} />
                    <span>Committed TPS</span>
                  </div>
                </div>
              </div>
              <div className="chart-body">
                <ResponsiveSvgChart
                  data={timeSeries}
                  series={[
                    { key: "submittedTps", color: "#6366f1", label: "Submitted" },
                    { key: "committedTps", color: "#06b6d4", label: "Committed" },
                  ]}
                  unit=" TPS"
                />
              </div>
            </div>

            {/* Chart 2: Transaction Latency */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Clock size={16} color="#f59e0b" />
                  <span>Transaction Latency Profile</span>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#f59e0b" }} />
                    <span>Avg Latency (ms)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#f43f5e" }} />
                    <span>P95 Latency (ms)</span>
                  </div>
                </div>
              </div>
              <div className="chart-body">
                <ResponsiveSvgChart
                  data={timeSeries}
                  series={[
                    { key: "avgLatency", color: "#f59e0b", label: "Average" },
                    { key: "p95Latency", color: "#f43f5e", label: "P95" },
                  ]}
                  unit=" ms"
                />
              </div>
            </div>

            {/* Chart 3: Mempool Size */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Database size={16} color="#06b6d4" />
                  <span>Mempool Backlog Over Time</span>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#06b6d4" }} />
                    <span>Unconfirmed Txs</span>
                  </div>
                </div>
              </div>
              <div className="chart-body">
                <ResponsiveSvgChart
                  data={timeSeries}
                  series={[{ key: "mempoolSize", color: "#06b6d4", label: "Mempool" }]}
                  unit=" txs"
                />
              </div>
            </div>

            {/* Chart 4: Block Progression */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Layers size={16} color="#10b981" />
                  <span>Block Height Progression</span>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#10b981" }} />
                    <span>Block Height</span>
                  </div>
                </div>
              </div>
              <div className="chart-body">
                <ResponsiveSvgChart
                  data={timeSeries}
                  series={[{ key: "blockHeight", color: "#10b981", label: "Height" }]}
                  zeroBaseline={false}
                />
              </div>
            </div>

            {/* Chart 5: System Hardware Resources */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <Cpu size={16} color="#a5b4fc" />
                  <span>CPU & RAM Consumption</span>
                </div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#a5b4fc" }} />
                    <span>CPU (%)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot" style={{ background: "#34d399" }} />
                    <span>RAM (MB)</span>
                  </div>
                </div>
              </div>
              <div className="chart-body">
                <ResponsiveSvgChart
                  data={timeSeries}
                  series={[
                    { key: "cpuPercent", color: "#a5b4fc", label: "CPU %" },
                    { key: "memoryMb", color: "#34d399", label: "RAM MB" },
                  ]}
                />
              </div>
            </div>

            {/* Chart 6: Success vs Failure Donut */}
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>Transaction Success vs Failure</span>
                </div>
              </div>
              <div className="chart-body">
                <SuccessDonutChart success={metrics.successful} failed={metrics.failed} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Validator Availability & Live BFT Node Outage Testing ── */}
        <section style={{ marginBottom: "32px" }}>
          <div className="section-title">
            <Shield size={20} color="#06b6d4" />
            <span>Validator Availability & Byzantine Fault Tolerance (BFT) Live Disruption</span>
          </div>
          <div className="section-desc">
            Toggle individual validator nodes offline while the stress test is actively generating transactions to observe live BFT consensus resilience.
          </div>

          {/* BFT Interactive Explainer & Quick Disruption Controls */}
          <div className="bft-banner-box">
            <div className="bft-banner-text">
              <div className="bft-banner-title">
                <Zap size={18} color="#06b6d4" />
                <span>Byzantine Fault Tolerance (N = 4, tolerates f = 1 faulty node)</span>
              </div>
              <div className="bft-banner-desc">
                CometBFT requires &gt; 2/3 (66.7%) of active voting power to commit blocks. With 4 validators totaling ~50,500 voting power, toggling <strong>Node 3</strong> or <strong>Node 4</strong> offline leaves <strong>80.2%</strong> voting power active—transactions continue being included in blocks without halting!
              </div>
            </div>

            <div className="bft-quick-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => toggleValidator("node4", validatorNodes.find((n) => n.id === "node4")?.isOnline ? "stop" : "start")}
                disabled={togglingNodeId !== null}
                style={{ borderColor: "rgba(244, 63, 94, 0.4)", color: "#fb7185" }}
              >
                <Power size={13} /> {validatorNodes.find((n) => n.id === "node4")?.isOnline ? "Kill Node 4 (Worker)" : "Restart Node 4"}
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => toggleValidator("node3", validatorNodes.find((n) => n.id === "node3")?.isOnline ? "stop" : "start")}
                disabled={togglingNodeId !== null}
                style={{ borderColor: "rgba(244, 63, 94, 0.4)", color: "#fb7185" }}
              >
                <Power size={13} /> {validatorNodes.find((n) => n.id === "node3")?.isOnline ? "Kill Node 3 (Worker)" : "Restart Node 3"}
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={restartAllValidators}
                disabled={togglingNodeId !== null || validatorNodes.every((n) => n.isOnline)}
              >
                <RotateCcw size={13} /> Restore All Nodes (100% Quorum)
              </button>
            </div>
          </div>

          {/* 4 Validator Cards */}
          <div className="validator-grid">
            {validatorNodes.map((node) => {
              const isTogglingThis = togglingNodeId === node.id || togglingNodeId === "all";
              const isOnline = node.isOnline;

              return (
                <div key={node.id} className={`validator-card ${!isOnline ? "offline" : ""}`}>
                  <div className="val-top">
                    <div className="val-name">
                      <span className={`pulse-dot ${isOnline ? "emerald" : "rose"}`} />
                      <span>{node.name}</span>
                    </div>
                    <span className="badge-tag info">Port {node.evmPort}</span>
                  </div>

                  <div className="val-addr">
                    {node.operatorAddress
                      ? `${node.operatorAddress.substring(0, 14)}...${node.operatorAddress.substring(node.operatorAddress.length - 8)}`
                      : "c99valoper1..."}
                  </div>

                  <div className="val-power-bar">
                    <div
                      className={`val-power-fill ${!isOnline ? "offline" : ""}`}
                      style={{ width: `${node.votingPercent}%` }}
                    />
                  </div>

                  <div className="val-meta">
                    <span>Power: {node.votingPower?.toLocaleString() || "10,000"} VP</span>
                    <span>{node.votingPercent}% Share</span>
                  </div>

                  <div style={{ fontSize: "0.75rem", color: isOnline ? "#cbd5e1" : "#f43f5e", display: "flex", justifyContent: "space-between" }}>
                    <span>Status: {isOnline ? (node.catchingUp ? "Syncing..." : "Voting in Consensus") : "Offline (Process Halted)"}</span>
                    <span style={{ fontFamily: "var(--font-mono, monospace)" }}>
                      {isOnline ? (node.latestBlockHeight ? `#${node.latestBlockHeight}` : "Active") : "Stopped"}
                    </span>
                  </div>

                  {/* BFT Role Hint */}
                  <div style={{ fontSize: "0.72rem", color: "#64748b", fontStyle: "italic", lineHeight: 1.4 }}>
                    {node.id === "node1" && "Primary JSON-RPC interface. Engine auto-fails over if stopped."}
                    {node.id === "node2" && "Consensus proposer leader (39.6% VP). Stopping halts consensus (<67% quorum)."}
                    {node.id === "node3" && "Worker validator (19.8% VP). Fault-tolerant: consensus continues uninterrupted."}
                    {node.id === "node4" && "Worker validator (19.8% VP). Fault-tolerant: consensus continues uninterrupted."}
                  </div>

                  {/* Interactive Toggle Control Row */}
                  <div className="val-control-row">
                    <span className={`val-status-pill ${isOnline ? "online" : "offline"}`}>
                      {isOnline ? "ONLINE" : "OFFLINE"}
                    </span>

                    {isOnline ? (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => toggleValidator(node.id, "stop")}
                        disabled={isTogglingThis}
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                      >
                        <Power size={12} /> {isTogglingThis ? "Stopping..." : "Stop Node"}
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => toggleValidator(node.id, "start")}
                        disabled={isTogglingThis}
                        style={{ padding: "4px 10px", fontSize: "0.75rem" }}
                      >
                        <RotateCcw size={12} /> {isTogglingThis ? "Starting..." : "Restart Node"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Chain Failure & Incident Detection Panel ──────────────── */}
        <section className="incident-table-card">
          <div className="section-title" style={{ marginBottom: "12px" }}>
            <AlertTriangle size={20} color="#f59e0b" />
            <span>Chain Failure Detection & Anomaly Log</span>
          </div>
          <div className="section-desc">
            Automated heuristic monitoring detects block stalls, quorum loss, latency spikes, and RPC timeouts.
          </div>

          {incidents.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "#64748b", background: "rgba(0,0,0,0.2)", borderRadius: "10px" }}>
              <CheckCircle2 size={24} color="#10b981" style={{ margin: "0 auto 8px auto" }} />
              <div>No chain failures or consensus halts detected during this session.</div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Incident Type</th>
                  <th>Block Height</th>
                  <th>TPS at Trigger</th>
                  <th>Pending Txs</th>
                  <th>Details</th>
                  <th>Recovery State</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{inc.timestamp}</td>
                    <td>
                      <span className="badge-tag danger">{inc.title}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono, monospace)" }}>#{inc.blockHeight}</td>
                    <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{inc.tpsAtFailure} TPS</td>
                    <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{inc.pendingCount}</td>
                    <td style={{ maxWidth: "260px" }}>{inc.details}</td>
                    <td>
                      {inc.recovered ? (
                        <span className="badge-tag recovered">
                          Recovered ({inc.recoveryTime || "Normal"})
                        </span>
                      ) : (
                        <span className="badge-tag danger">Active Incident</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── Live Transaction Feed ──────────────────────────────────── */}
        <section className="tx-feed-card">
          <div className="section-title" style={{ marginBottom: "12px" }}>
            <Radio size={20} color="#06b6d4" />
            <span>Live Transaction Ingestion Feed (Recent 20 Txs)</span>
          </div>

          <div className="tx-feed-wrapper">
            {recentTxs.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b" }}>
                No stress transactions dispatched yet. Click "Start Test" above.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tx Hash</th>
                    <th>Type</th>
                    <th>Signer Wallet</th>
                    <th>Nonce</th>
                    <th>Latency</th>
                    <th>Block</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTxs.map((tx, idx) => (
                    <tr key={tx.hash || idx}>
                      <td style={{ fontFamily: "var(--font-mono, monospace)", color: "#06b6d4" }}>
                        {tx.hash.startsWith("failed-")
                          ? tx.hash.substring(0, 18) + "..."
                          : `${tx.hash.substring(0, 12)}...${tx.hash.substring(tx.hash.length - 8)}`}
                      </td>
                      <td>
                        <span className="badge-tag info">{tx.type}</span>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)" }}>
                        Wallet #{tx.walletIndex} ({tx.from ? `${tx.from.substring(0, 6)}...` : "--"})
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{tx.nonce}</td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)" }}>
                        {tx.latencyMs !== null ? `${tx.latencyMs}ms` : "Pending..."}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono, monospace)" }}>
                        {tx.blockNumber ? `#${tx.blockNumber}` : "Pending"}
                      </td>
                      <td>
                        {tx.status === "mined" && <span className="badge-tag recovered">MINED</span>}
                        {tx.status === "pending" && <span className="badge-tag info">IN-FLIGHT</span>}
                        {tx.status === "failed" && <span className="badge-tag danger">FAILED</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* ── High-Load Safety Confirmation Modal ────────────────────── */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "520px" }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "#f59e0b" }}>
                <AlertTriangle size={24} /> High-Intensity Stress Test Warning
              </div>
              <button
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                onClick={() => setShowConfirmModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ color: "#cbd5e1", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "20px" }}>
              You are about to launch a high-throughput load test against the local Chain99 blockchain network:
            </p>

            <div style={{ background: "rgba(255,255,255,0.04)", padding: "14px", borderRadius: "10px", marginBottom: "20px", fontFamily: "var(--font-mono, monospace)", fontSize: "0.85rem" }}>
              <div>• Target Rate : <strong>{targetTps} TPS</strong></div>
              <div>• Total Txs   : <strong>{totalTransactions} transactions</strong></div>
              <div>• Concurrency : <strong>{concurrency} in-flight</strong></div>
              <div>• Duration    : <strong>{durationSeconds} seconds</strong></div>
            </div>

            <p style={{ color: "#94a3b8", fontSize: "0.82rem", marginBottom: "24px" }}>
              This will stress CometBFT consensus round transitions and LevelDB writes. You can cancel or stop the test at any time using the Stop button.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={executeStart}>
                Confirm & Launch Stress Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Benchmark Final Results Modal ──────────────────────────── */}
      {showReportModal && report && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">
                <FileText size={24} color="#10b981" />
                <span>Chain99 Stress Test Benchmark Report</span>
              </div>
              <button
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
                onClick={() => setShowReportModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Verdict Badge */}
            <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span className={`badge-tag ${report.overallResult.includes("PASSED") ? "recovered" : "danger"}`} style={{ fontSize: "0.9rem", padding: "6px 14px" }}>
                {report.overallResult}
              </span>
              <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                Executed on {new Date(report.testTimestamp).toLocaleString()}
              </span>
            </div>

            <div className="report-grid">
              <div className="report-box">
                <div className="report-box-label">Transactions Attempted</div>
                <div className="report-box-val">{report.totalTransactionsAttempted}</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Transactions Committed</div>
                <div className="report-box-val" style={{ color: "#10b981" }}>{report.totalTransactionsCommitted}</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Failed Transactions</div>
                <div className="report-box-val" style={{ color: report.totalFailedTransactions > 0 ? "#f43f5e" : "#64748b" }}>
                  {report.totalFailedTransactions}
                </div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Success Rate</div>
                <div className="report-box-val" style={{ color: "#06b6d4" }}>{report.successRatePercent}%</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Average TPS</div>
                <div className="report-box-val">{report.averageTps}</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Peak TPS</div>
                <div className="report-box-val" style={{ color: "#6366f1" }}>{report.peakTps}</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Max Sustainable TPS</div>
                <div className="report-box-val">{report.maxSustainableTps}</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Avg / P95 Latency</div>
                <div className="report-box-val" style={{ color: "#f59e0b" }}>
                  {report.latencyMs.avg} / {report.latencyMs.p95} ms
                </div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Blocks Produced</div>
                <div className="report-box-val">
                  {report.blockProduction.blocksProduced} (#{report.blockProduction.startBlock} → #{report.blockProduction.endBlock})
                </div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Avg Block Interval</div>
                <div className="report-box-val">{report.blockProduction.averageBlockTimeSeconds}s</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">Consensus Interruptions</div>
                <div className="report-box-val">{report.consensusPerformance.interruptionsCount}</div>
              </div>
              <div className="report-box">
                <div className="report-box-label">LevelDB Growth / Tx</div>
                <div className="report-box-val">
                  {report.hardwareImpact.dbStateGrowthBytesPerTx > 0 ? `~${report.hardwareImpact.dbStateGrowthBytesPerTx} B` : "N/A"}
                </div>
              </div>
            </div>

            {/* Error breakdown if any */}
            {Object.keys(report.errorBreakdown || {}).length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f43f5e", marginBottom: "8px" }}>
                  Error Breakdown:
                </div>
                <div style={{ background: "rgba(244, 63, 94, 0.08)", padding: "12px", borderRadius: "8px", fontSize: "0.8rem", fontFamily: "var(--font-mono, monospace)" }}>
                  {Object.entries(report.errorBreakdown).map(([err, cnt], i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <span>{err}</span>
                      <span style={{ fontWeight: 700 }}>{cnt} occurrences</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="report-actions">
              <button className="btn btn-secondary" onClick={() => handleExport("csv")}>
                <Download size={16} /> Download CSV
              </button>
              <button className="btn btn-primary" onClick={() => handleExport("json")}>
                <Download size={16} /> Download JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

