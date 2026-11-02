"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Wallet,
  Radio,
  Layers,
  FileCheck,
  Share2,
  Cpu,
  Database,
  Lock,
  Receipt,
  CheckCircle,
  Clock,
  ArrowRight,
  Shield,
  Zap,
} from "lucide-react";

const LIFECYCLE_STEPS = [
  {
    step: 1,
    id: "create",
    title: "1. User Creates Transaction",
    shortTitle: "MetaMask",
    icon: Wallet,
    accent: "#6366f1",
    summary:
      "Alice signs a 10 C99 transfer with her Ethereum-compatible private key in MetaMask. The private key never leaves the wallet.",
    details: [
      "Recipient: Bob (0xB5624B51cA8495a639b56f2f0aB9D671206121D5)",
      "Sender: Alice (0x86fc95292215c26ec49b1ff3f9ae61be5271cf57)",
      "Amount: 10 C99 (10 × 10¹⁸ ac99 base units)",
      "Chain ID: 9999 (Cosmos EVM Devnet)",
      "Security: Signed locally with secp256k1 ECDSA. The private key NEVER leaves Alice's wallet or browser.",
    ],
  },
  {
    step: 2,
    id: "rpc",
    title: "2. Transaction Enters RPC",
    shortTitle: "EVM RPC",
    icon: Radio,
    accent: "#06b6d4",
    summary:
      "The signed payload travels over HTTP to the EVM JSON-RPC endpoint at 127.0.0.1:8545.",
    details: [
      "Endpoint: http://127.0.0.1:8545 via eth_sendRawTransaction.",
      "Syntactic Validation: RPC server checks RLP encoding, decodes ECDSA v, r, s values.",
      "Signature Recovery: ecrecover confirms the sender address matches Alice's public key.",
      "Basic Sanity: Checks account nonce to prevent replay attacks and ensures Alice has sufficient balance for gas and value.",
    ],
  },
  {
    step: 3,
    id: "mempool",
    title: "3. CometBFT Mempool",
    shortTitle: "Mempool",
    icon: Layers,
    accent: "#f59e0b",
    summary:
      "The transaction enters the local CometBFT mempool, waiting to be selected for inclusion in a candidate block.",
    details: [
      "ABCI CheckTx: Mempool runs CheckTx to verify fees and sequence numbers before admission.",
      "Unconfirmed State: Transactions in the mempool are pending and NOT yet finalized.",
      "P2P Mempool Gossip: The transaction is broadcast across all 4 validator nodes in the mesh topology.",
      "Fee Ordering: Transactions with higher EIP-1559 priority tips receive preferential ordering.",
    ],
  },
  {
    step: 4,
    id: "proposal",
    title: "4. Block Proposal Created",
    shortTitle: "Proposal",
    icon: FileCheck,
    accent: "#a855f7",
    summary:
      "The designated proposer selects transactions from its mempool and bundles them into candidate Block #294.",
    details: [
      "Proposer Election: Selected by CometBFT's deterministic round-robin algorithm weighted by active voting power.",
      "Block #294 Candidate: Includes Alice's 10 C99 transfer, plus pending contract calls.",
      "Gas Metering: Proposer ensures total block gas does not exceed the consensus limit (30,000,000 gas).",
      "ABCI PrepareProposal: Allows Cosmos SDK to curate, inject, or reorder transactions before broadcasting.",
    ],
  },
  {
    step: 5,
    id: "propagation",
    title: "5. Block Propagation to Validators",
    shortTitle: "P2P Gossip",
    icon: Share2,
    accent: "#ec4899",
    summary:
      "The candidate block is propagated across the P2P mesh network to all 4 independent validator nodes for verification.",
    details: [
      "Validator 1, 2, 3, and 4 each receive the proposed block parts over TCP gossip.",
      "ABCI ProcessProposal: Every validator independently checks block validity and transaction validity.",
      "Header Checks: Validates parent hash, proposer signature, block timestamp, and consensus parameters.",
      "Consensus Ready: If valid, validators prepare to cast consensus prevote messages.",
    ],
  },
  {
    step: 6,
    id: "execution",
    title: "6. Cosmos EVM Execution & State Transition",
    shortTitle: "EVM Exec",
    icon: Cpu,
    accent: "#10b981",
    summary:
      "Validators execute the block deterministically in Cosmos EVM, updating balances from Alice (100 → 90) to Bob (20 → 30).",
    details: [
      "Bytecode Execution: EVM reads Alice's balance (100 C99) and deducts 10 C99 + gas fees.",
      "Credit Recipient: Adds 10 C99 to Bob's balance (20 C99 → 30 C99).",
      "Gas Accounting: EIP-1559 base fee is burned; validator tips are collected.",
      "State Isolation: Execution generates a proposed state transition diff in StateDB prior to final block commitment.",
    ],
  },
  {
    step: 7,
    id: "appstate",
    title: "7. Cosmos SDK & EVM State Updates",
    shortTitle: "State Layers",
    icon: Database,
    accent: "#38bdf8",
    summary:
      "Cosmos SDK modules and EVM StateDB synchronize: x/bank, x/auth, EVM storage, and Merkle tries are updated.",
    details: [
      "EVM Account State: StateDB records updated nonces and EVM balance slots.",
      "Cosmos SDK x/bank: Authoritative ledger commits balance diffs in ac99 units.",
      "Cosmos SDK x/auth: Increments sequence number for Alice's account.",
      "IAVL+ Tree & Merkle State: State hashes are computed to form the new application state root.",
    ],
  },
  {
    step: 8,
    id: "commitment",
    title: "8. Block Commitment & Finality",
    shortTitle: "Consensus Commit",
    icon: Lock,
    accent: "#14b8a6",
    summary:
      "Over 2/3 of validator voting power precommits. The block is committed irrevocably with deterministic single-block finality.",
    details: [
      "Consensus Polka & Quorum: CometBFT registers > 46,666.67 voting power (out of 70,000 total).",
      "Block Committed: Height advances to #294 and is written to persistent LevelDB storage.",
      "Deterministic Finality: The transaction cannot be reorganized or rolled back (zero probabilistic risk).",
      "Event Indexing: CometBFT and EVM event logs are indexed for JSON-RPC queries.",
    ],
  },
  {
    step: 9,
    id: "receipt",
    title: "9. Transaction Receipt Available",
    shortTitle: "Receipt",
    icon: Receipt,
    accent: "#22c55e",
    summary:
      "The client queries eth_getTransactionReceipt. The transaction status is confirmed with status 0x1 (Success).",
    details: [
      "Status: 0x1 (Success)",
      "Transaction Hash: 0x7f4a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a",
      "Block Number: 294",
      "Gas Used: 21,000 / 21,000 (100% standard transfer)",
      "Finality: Committed & Non-Reversible",
    ],
  },
];

export default function SectionBLifecycle() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 0.5, 1, 2, 4
  const timerRef = useRef(null);

  // Balances for Step 6 simulation
  const [aliceBal, setAliceBal] = useState(100);
  const [bobBal, setBobBal] = useState(20);
  const [balAnimating, setBalAnimating] = useState(false);

  // Playback loop
  useEffect(() => {
    if (isPlaying) {
      const stepDuration = 3200 / speed;
      timerRef.current = setTimeout(() => {
        setCurrentStep((prev) => {
          if (prev >= LIFECYCLE_STEPS.length) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, stepDuration);
    }
    return () => clearTimeout(timerRef.current);
  }, [isPlaying, currentStep, speed]);

  // Balance animation trigger when reaching or passing Step 6
  useEffect(() => {
    if (currentStep < 6) {
      setAliceBal(100);
      setBobBal(20);
      setBalAnimating(false);
    } else if (currentStep === 6) {
      setBalAnimating(true);
      const timer = setTimeout(() => {
        setAliceBal(90);
        setBobBal(30);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setAliceBal(90);
      setBobBal(30);
      setBalAnimating(false);
    }
  }, [currentStep]);

  const activeStepData = LIFECYCLE_STEPS[currentStep - 1];
  const StepIcon = activeStepData.icon;

  const handlePlayPause = () => {
    if (currentStep >= LIFECYCLE_STEPS.length && !isPlaying) {
      setCurrentStep(1);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    setCurrentStep(1);
    setAliceBal(100);
    setBobBal(20);
  };

  const handleNext = () => {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    if (currentStep < LIFECYCLE_STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <section id="section-lifecycle" className="arch-section">
      <div className="arch-section-header">
        <span className="arch-section-tag">
          <Zap size={14} /> Section B — Core Mechanics
        </span>
        <h2 className="arch-title">Complete Transaction Lifecycle</h2>
        <p className="arch-subtitle">
          Watch a live simulated transaction journey from MetaMask signature,
          through CometBFT mempool, multi-validator block proposal, Cosmos EVM
          execution, state update, and deterministic finality.
        </p>
      </div>

      {/* Simulator Control Bar */}
      <div className="sim-toolbar">
        <div className="sim-btn-group">
          <button
            className="sim-btn primary"
            onClick={handlePlayPause}
            title={isPlaying ? "Pause simulation" : "Play simulation"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? "Pause" : currentStep === 9 ? "Restart" : "Play Simulation"}</span>
          </button>

          <button
            className="sim-btn"
            onClick={handlePrev}
            disabled={currentStep === 1}
            title="Previous Step"
          >
            <SkipBack size={15} /> Prev
          </button>

          <button
            className="sim-btn"
            onClick={handleNext}
            disabled={currentStep === LIFECYCLE_STEPS.length}
            title="Next Step"
          >
            Next <SkipForward size={15} />
          </button>

          <button className="sim-btn" onClick={handleReset} title="Reset to Step 1">
            <RotateCcw size={15} /> Reset
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Speed:</span>
          <div className="sim-speed-selector">
            {[0.5, 1, 2, 4].map((s) => (
              <button
                key={s}
                className={`sim-speed-btn ${speed === s ? "active" : ""}`}
                onClick={() => setSpeed(s)}
              >
                {s}x
              </button>
            ))}
          </div>

          <div
            style={{
              fontSize: "0.78rem",
              padding: "4px 10px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.05)",
              color: "#cbd5e1",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            Step {currentStep} of 9
          </div>
        </div>
      </div>

      {/* Horizontal Step Timeline Bar */}
      <div className="stepper-header">
        {LIFECYCLE_STEPS.map((s) => {
          const isActive = s.step === currentStep;
          const isCompleted = s.step < currentStep;

          return (
            <button
              key={s.step}
              className={`step-indicator-btn ${isActive ? "active" : ""} ${
                isCompleted ? "completed" : ""
              }`}
              onClick={() => {
                setIsPlaying(false);
                clearTimeout(timerRef.current);
                setCurrentStep(s.step);
              }}
            >
              <div className="step-circle">
                {isCompleted ? <CheckCircle size={14} /> : s.step}
              </div>
              <span className="step-label-text">{s.shortTitle}</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Stage for Active Step */}
      <div className="step-stage-card">
        {/* Left Sub-Panel: Detailed Step Explanation & Parameters */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${activeStepData.accent}20`,
                border: `1px solid ${activeStepData.accent}60`,
                color: activeStepData.accent,
              }}
            >
              <StepIcon size={22} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: activeStepData.accent,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Lifecycle Phase {activeStepData.step} / 9
              </div>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                {activeStepData.title}
              </h3>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "10px",
              padding: "14px 16px",
              fontSize: "0.92rem",
              lineHeight: 1.6,
              color: "#cbd5e1",
            }}
          >
            {activeStepData.summary}
          </div>

          <div>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "8px",
              }}
            >
              Protocol Verification Details
            </div>
            <ul
              style={{
                paddingLeft: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                fontSize: "0.85rem",
                color: "#94a3b8",
              }}
            >
              {activeStepData.details.map((detail, idx) => (
                <li key={idx}>
                  <span style={{ color: "#e2e8f0" }}>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Sub-Panel: Dedicated Visual Representation */}
        <div className="step-anim-visual">
          {/* STEP 1: MetaMask Mockup */}
          {currentStep === 1 && (
            <div
              style={{
                width: "100%",
                maxWidth: "340px",
                background: "#141724",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                borderRadius: "14px",
                padding: "18px",
                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: "10px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#10b981",
                    }}
                  />
                  <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>
                    MetaMask Wallet
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.72rem",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(99, 102, 241, 0.2)",
                    color: "#a5b4fc",
                  }}
                >
                  Chain ID 9999
                </span>
              </div>

              <div
                style={{
                  fontSize: "0.8rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                <div style={{ color: "#94a3b8" }}>
                  From:{" "}
                  <span style={{ color: "#6366f1" }}>Alice (0x86fc...cf57)</span>
                </div>
                <div style={{ color: "#94a3b8" }}>
                  To:{" "}
                  <span style={{ color: "#06b6d4" }}>Bob (0xB562...21D5)</span>
                </div>
                <div
                  style={{
                    padding: "10px",
                    margin: "8px 0",
                    background: "rgba(0,0,0,0.3)",
                    borderRadius: "8px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff" }}>
                    10.00 C99
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#10b981" }}>
                    Est. Gas: ~21,000 | Nonce: #42
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "#64748b",
                    textAlign: "center",
                  }}
                >
                  🔒 Private key never leaves device • secp256k1 signed
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: RPC Endpoint */}
          {currentStep === 2 && (
            <div
              style={{
                width: "100%",
                maxWidth: "360px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(6, 182, 212, 0.12)",
                  border: "1px solid rgba(6, 182, 212, 0.35)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.85rem",
                  color: "#06b6d4",
                }}
              >
                POST http://127.0.0.1:8545
              </div>
              <div
                style={{
                  background: "rgba(0,0,0,0.5)",
                  padding: "12px",
                  borderRadius: "10px",
                  textAlign: "left",
                  fontSize: "0.76rem",
                  fontFamily: "var(--font-mono, monospace)",
                  color: "#cbd5e1",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div>{`{`}</div>
                <div style={{ paddingLeft: "12px" }}>&quot;jsonrpc&quot;: &quot;2.0&quot;,</div>
                <div style={{ paddingLeft: "12px" }}>&quot;method&quot;: &quot;eth_sendRawTransaction&quot;,</div>
                <div style={{ paddingLeft: "12px" }}>
                  &quot;params&quot;: [&quot;0x02f8710182270f80...&quot;]
                </div>
                <div>{`}`}</div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontSize: "0.78rem",
                  color: "#10b981",
                }}
              >
                <CheckCircle size={14} /> Signature recovered: 0x86fc...cf57
              </div>
            </div>
          )}

          {/* STEP 3: Mempool Visualizer */}
          {currentStep === 3 && (
            <div style={{ width: "100%", maxWidth: "360px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.78rem",
                  marginBottom: "8px",
                  color: "#f59e0b",
                  fontWeight: 600,
                }}
              >
                <span>CometBFT Tx Mempool</span>
                <span>Unconfirmed Queue</span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid #f59e0b",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontFamily: "var(--font-mono, monospace)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#fff", fontWeight: 700 }}>
                    ★ Alice → Bob: 10 C99
                  </span>
                  <span
                    style={{
                      background: "#f59e0b",
                      color: "#000",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontSize: "0.68rem",
                      fontWeight: 800,
                    }}
                  >
                    IN MEMPOOL
                  </span>
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "#64748b",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Tx #0x12a3: Swap 50 ac99</span>
                  <span>Pending</span>
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "#64748b",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Tx #0x9bf4: Storage.setValue(99)</span>
                  <span>Pending</span>
                </div>
              </div>
              <div
                style={{
                  marginTop: "12px",
                  fontSize: "0.72rem",
                  color: "#94a3b8",
                  textAlign: "center",
                }}
              >
                ⚠️ Mempool transactions are unconfirmed and NOT yet finalized.
              </div>
            </div>
          )}

          {/* STEP 4: Candidate Block Proposal */}
          {currentStep === 4 && (
            <div
              style={{
                width: "100%",
                maxWidth: "340px",
                border: "2px dashed #a855f7",
                borderRadius: "14px",
                padding: "16px",
                background: "rgba(168, 85, 247, 0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>
                  Candidate Block #294
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(168, 85, 247, 0.3)",
                    color: "#e9d5ff",
                  }}
                >
                  Proposer: Node 4
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.76rem",
                }}
              >
                <div
                  style={{
                    padding: "6px 10px",
                    background: "rgba(168, 85, 247, 0.2)",
                    borderRadius: "6px",
                    color: "#fff",
                  }}
                >
                  Tx 1: Alice → Bob (10 C99)
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "6px",
                    color: "#94a3b8",
                  }}
                >
                  Tx 2: Storage.setValue(99)
                </div>
                <div
                  style={{
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "6px",
                    color: "#94a3b8",
                  }}
                >
                  Tx 3: StakingPrecompile.delegate()
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Block Propagation (4 Validators) */}
          {currentStep === 5 && (
            <div style={{ width: "100%", maxWidth: "380px" }}>
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.8rem",
                  color: "#ec4899",
                  fontWeight: 700,
                  marginBottom: "14px",
                }}
              >
                P2P Block Broadcast Across Validator Mesh
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                {["Node 1 (Port 26656)", "Node 2 (Port 26666)", "Node 3 (Port 26676)", "Node 4 (Proposer)"].map(
                  (val, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "rgba(236, 72, 153, 0.1)",
                        border: "1px solid rgba(236, 72, 153, 0.35)",
                        borderRadius: "8px",
                        padding: "10px",
                        textAlign: "center",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#fff" }}>
                        Validator {idx + 1}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#f472b6" }}>
                        {val}
                      </div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "#10b981",
                          marginTop: "4px",
                        }}
                      >
                        ✓ Verified Block #294
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Cosmos EVM Execution & Dynamic State Animation */}
          {currentStep === 6 && (
            <div style={{ width: "100%", maxWidth: "380px" }}>
              <div
                style={{
                  textAlign: "center",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#10b981",
                  marginBottom: "12px",
                }}
              >
                Cosmos EVM State Transition Simulation
              </div>

              <div className="balance-change-box">
                {/* Alice Account */}
                <div className="balance-account">
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Alice (Sender)
                  </span>
                  <div
                    className={`balance-val ${
                      balAnimating && aliceBal === 90 ? "decreasing" : ""
                    }`}
                  >
                    {aliceBal} C99
                  </div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: aliceBal === 90 ? "#f43f5e" : "#64748b",
                    }}
                  >
                    {aliceBal === 90 ? "-10 C99 transferred" : "Initial 100 C99"}
                  </span>
                </div>

                <ArrowRight size={20} color="#10b981" />

                {/* Bob Account */}
                <div className="balance-account">
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                    Bob (Recipient)
                  </span>
                  <div
                    className={`balance-val ${
                      balAnimating && bobBal === 30 ? "increasing" : ""
                    }`}
                  >
                    {bobBal} C99
                  </div>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      color: bobBal === 30 ? "#10b981" : "#64748b",
                    }}
                  >
                    {bobBal === 30 ? "+10 C99 received" : "Initial 20 C99"}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  fontSize: "0.72rem",
                  color: "#94a3b8",
                  textAlign: "center",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                Deterministic EVM Opcode Execution • 21,000 Gas Metered
              </div>
            </div>
          )}

          {/* STEP 7: Cosmos SDK Modules vs EVM State */}
          {currentStep === 7 && (
            <div style={{ width: "100%", maxWidth: "380px" }}>
              <div
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#38bdf8",
                  textAlign: "center",
                  marginBottom: "12px",
                }}
              >
                Dual State Update Architecture
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    background: "rgba(139, 92, 246, 0.12)",
                    border: "1px solid rgba(139, 92, 246, 0.35)",
                    borderRadius: "10px",
                    padding: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#c084fc",
                    }}
                  >
                    EVM State Layer
                  </div>
                  <ul
                    style={{
                      fontSize: "0.68rem",
                      color: "#cbd5e1",
                      marginTop: "6px",
                      paddingLeft: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    <li>StateDB accounts</li>
                    <li>Nonces & code hash</li>
                    <li>Contract storage trie</li>
                  </ul>
                </div>

                <div
                  style={{
                    background: "rgba(6, 182, 212, 0.12)",
                    border: "1px solid rgba(6, 182, 212, 0.35)",
                    borderRadius: "10px",
                    padding: "10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "#38bdf8",
                    }}
                  >
                    Cosmos SDK Modules
                  </div>
                  <ul
                    style={{
                      fontSize: "0.68rem",
                      color: "#cbd5e1",
                      marginTop: "6px",
                      paddingLeft: "14px",
                      lineHeight: 1.5,
                    }}
                  >
                    <li>x/bank (ac99 ledger)</li>
                    <li>x/auth (sequences)</li>
                    <li>IAVL+ Merkle tree</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Consensus Commitment & Finality */}
          {currentStep === 8 && (
            <div
              style={{
                width: "100%",
                maxWidth: "340px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(20, 184, 166, 0.2)",
                  border: "2px solid #14b8a6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#14b8a6",
                }}
              >
                <Lock size={28} />
              </div>

              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                Block #294 Committed!
              </div>

              <div
                style={{
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.2)",
                  border: "1px solid #10b981",
                  color: "#34d399",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                Deterministic 1-Block Finality Achieved
              </div>

              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                100% of online voting power precommitted. Reorgs impossible.
              </div>
            </div>
          )}

          {/* STEP 9: Transaction Receipt */}
          {currentStep === 9 && (
            <div className="tx-receipt-card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  paddingBottom: "8px",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    color: "#10b981",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <CheckCircle size={14} /> eth_getTransactionReceipt
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: "rgba(16, 185, 129, 0.2)",
                    color: "#34d399",
                  }}
                >
                  Finalized
                </span>
              </div>

              <div className="tx-receipt-row">
                <span style={{ color: "#94a3b8" }}>Status</span>
                <span style={{ color: "#10b981", fontWeight: 700 }}>
                  0x1 (SUCCESS)
                </span>
              </div>
              <div className="tx-receipt-row">
                <span style={{ color: "#94a3b8" }}>Block Height</span>
                <span style={{ color: "#fff" }}>#294</span>
              </div>
              <div className="tx-receipt-row">
                <span style={{ color: "#94a3b8" }}>Tx Hash</span>
                <span style={{ color: "#06b6d4", fontSize: "0.72rem" }}>
                  0x7f4a9b2c3d4e...8e9f
                </span>
              </div>
              <div className="tx-receipt-row">
                <span style={{ color: "#94a3b8" }}>Gas Used</span>
                <span style={{ color: "#fff" }}>21,000 (100%)</span>
              </div>
              <div className="tx-receipt-row">
                <span style={{ color: "#94a3b8" }}>Finality Engine</span>
                <span style={{ color: "#a855f7" }}>CometBFT v0.38.12</span>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "0.66rem",
                  color: "#64748b",
                  borderTop: "1px dashed rgba(255,255,255,0.08)",
                  paddingTop: "6px",
                  textAlign: "center",
                }}
              >
                * Illustrative educational simulation — not executing on live mainnet.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

