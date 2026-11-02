"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Flame,
  Skull,
  Clock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  Zap,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingDown,
} from "lucide-react";

export default function SectionFSlashing() {
  const [activeTab, setActiveTab] = useState("double_signing"); // 'double_signing' | 'downtime' | 'unbonding'

  // ── Punishment 1 State: Double-Signing ────────────────────────
  const [doubleSignTarget, setDoubleSignTarget] = useState(1);
  const [doubleSignStep, setDoubleSignStep] = useState(0); // 0: normal, 1: conflicting votes, 2: evidence, 3: slashed & tombstoned
  const [isDoubleSigningSimulating, setIsDoubleSigningSimulating] = useState(false);

  // ── Punishment 2 State: Downtime Sliding Window ───────────────
  const [windowTotalBlocks, setWindowTotalBlocks] = useState(10000);
  const [signedBlocks, setSignedBlocks] = useState(10000); // starts at 100%
  const [isJailed, setIsJailed] = useState(false);
  const [isSlashed01, setIsSlashed01] = useState(false);
  const [downtimeStake, setDowntimeStake] = useState(15000); // Validator 2

  const signingRate = ((signedBlocks / windowTotalBlocks) * 100).toFixed(1);

  // Handlers for Double-Signing
  const runDoubleSignSimulation = () => {
    setIsDoubleSigningSimulating(true);
    setDoubleSignStep(1);

    setTimeout(() => {
      setDoubleSignStep(2);
      setTimeout(() => {
        setDoubleSignStep(3);
        setIsDoubleSigningSimulating(false);
      }, 1400);
    }, 1400);
  };

  const resetDoubleSign = () => {
    setDoubleSignStep(0);
    setIsDoubleSigningSimulating(false);
  };

  // Handlers for Downtime
  const advanceDowntime = (missedCount) => {
    setSignedBlocks((prev) => {
      const next = Math.max(0, prev - missedCount);
      const nextRate = (next / windowTotalBlocks) * 100;
      if (nextRate < 50) {
        setIsJailed(true);
        setIsSlashed01(true);
        setDowntimeStake(15000 * 0.999); // 0.1% slash
      }
      return next;
    });
  };

  const unjailValidator = () => {
    setIsJailed(false);
    setSignedBlocks(5500); // recovered above threshold
  };

  const resetDowntime = () => {
    setSignedBlocks(10000);
    setIsJailed(false);
    setIsSlashed01(false);
    setDowntimeStake(15000);
  };

  return (
    <section id="section-slashing" className="arch-section">
      <div className="arch-section-header">
        <span className="arch-section-tag" style={{ color: "#f43f5e" }}>
          <ShieldAlert size={14} /> Section F — Cryptoeconomic Security & Slashing
        </span>
        <h2 className="arch-title">Punishments, Equivocation & Downtime</h2>
        <p className="arch-subtitle">
          How Chain99 enforces Byzantine safety with automated stake slashing,
          permanent validator tombstoning, and unbonding lockup protections.
        </p>
      </div>

      {/* Tab Switcher */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <button
          className={`sim-btn ${
            activeTab === "double_signing" ? "danger" : ""
          }`}
          onClick={() => setActiveTab("double_signing")}
        >
          <Flame size={15} /> 1. Double-Signing Equivocation (5% + Tombstone)
        </button>

        <button
          className={`sim-btn ${activeTab === "downtime" ? "primary" : ""}`}
          onClick={() => setActiveTab("downtime")}
        >
          <Clock size={15} /> 2. Downtime & Jailing (10,000-Block Window)
        </button>

        <button
          className={`sim-btn ${activeTab === "unbonding" ? "primary" : ""}`}
          onClick={() => setActiveTab("unbonding")}
        >
          <Lock size={15} /> 3. 14-Day Unbonding & Historical Slashing
        </button>
      </div>

      {/* ── TAB 1: DOUBLE SIGNING ─────────────────────────────────── */}
      {activeTab === "double_signing" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {/* Left: Interactive Controls & Status */}
            <div
              style={{
                background: "rgba(10, 13, 22, 0.9)",
                border: "1px solid rgba(244, 63, 94, 0.3)",
                borderRadius: "14px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>
                  Equivocation Attack Simulator
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: "rgba(244, 63, 94, 0.2)",
                    color: "#fda4af",
                  }}
                >
                  Permanent Penalty
                </span>
              </div>

              <p style={{ fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                A double-signing (equivocation) attack occurs when a validator
                signs two different block proposals or conflicting prevotes at the
                exact same height and round.
              </p>

              {/* Validator Target Select */}
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Target Offending Node:
                <select
                  value={doubleSignTarget}
                  disabled={doubleSignStep > 0}
                  onChange={(e) => setDoubleSignTarget(Number(e.target.value))}
                  style={{
                    marginLeft: "8px",
                    background: "#080a10",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: "6px",
                    padding: "4px 8px",
                    fontFamily: "inherit",
                  }}
                >
                  <option value={1}>Validator 1 (10,000 C99)</option>
                  <option value={2}>Validator 2 (15,000 C99)</option>
                  <option value={3}>Validator 3 (20,000 C99)</option>
                  <option value={4}>Validator 4 (25,000 C99)</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  className="sim-btn danger"
                  onClick={runDoubleSignSimulation}
                  disabled={doubleSignStep > 0 || isDoubleSigningSimulating}
                >
                  <Flame size={15} /> Broadcast Conflicting Votes
                </button>
                <button className="sim-btn" onClick={resetDoubleSign}>
                  <RotateCcw size={15} /> Reset
                </button>
              </div>

              {/* Slashed Stake Calculation */}
              <div
                style={{
                  background: "rgba(0,0,0,0.4)",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.78rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Initial Stake:</span>
                  <span style={{ color: "#fff" }}>
                    {(doubleSignTarget * 5000 + 5000).toLocaleString()} C99
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#f43f5e" }}>5.0% Slashed Stake:</span>
                  <span style={{ color: "#f43f5e", fontWeight: 700 }}>
                    {doubleSignStep === 3
                      ? `-${((doubleSignTarget * 5000 + 5000) * 0.05).toLocaleString()} C99`
                      : "--"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Remaining Stake:</span>
                  <span style={{ color: doubleSignStep === 3 ? "#f59e0b" : "#fff" }}>
                    {doubleSignStep === 3
                      ? `${((doubleSignTarget * 5000 + 5000) * 0.95).toLocaleString()} C99`
                      : `${(doubleSignTarget * 5000 + 5000).toLocaleString()} C99`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Validator Status:</span>
                  <span
                    style={{
                      color: doubleSignStep === 3 ? "#f43f5e" : "#10b981",
                      fontWeight: 800,
                    }}
                  >
                    {doubleSignStep === 3 ? "TOMBSTONED (PERMANENT)" : "ACTIVE"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Step-by-Step Security Pipeline */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                justifyContent: "center",
              }}
            >
              {[
                {
                  title: "1. Validator Signs Conflicting Votes",
                  desc: "Signs two different Prevotes for Block #294A and #294B with identical Ed25519 consensus key.",
                  active: doubleSignStep >= 1,
                },
                {
                  title: "2. CometBFT Evidence Reactor Detects Equivocation",
                  desc: "Peer nodes gossip both signatures. CometBFT detects header collision and packages evidence.",
                  active: doubleSignStep >= 2,
                },
                {
                  title: "3. Cosmos x/slashing Executes 5% Stake Burn",
                  desc: "5.0% of bonded C99 is irrevocably burned from the validator pool to maintain consensus safety.",
                  active: doubleSignStep >= 3,
                },
                {
                  title: "4. Permanent Tombstoning",
                  desc: "Offending validator address is written to tombstone registry. Unjailing or re-entry is mathematically barred forever.",
                  active: doubleSignStep >= 3,
                  tombstone: true,
                },
              ].map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "10px",
                    background: step.active
                      ? step.tombstone
                        ? "rgba(244, 63, 94, 0.25)"
                        : "rgba(99, 102, 241, 0.2)"
                      : "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      step.active
                        ? step.tombstone
                          ? "#f43f5e"
                          : "rgba(99, 102, 241, 0.5)"
                        : "rgba(255,255,255,0.06)"
                    }`,
                    transition: "all 0.3s ease",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      color: step.active ? "#fff" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {step.active && <CheckCircle2 size={16} color="#06b6d4" />}
                    <span>{step.title}</span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.76rem",
                      color: step.active ? "#cbd5e1" : "#475569",
                      marginTop: "4px",
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: DOWNTIME SLIDING WINDOW ───────────────────────── */}
      {activeTab === "downtime" && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "24px",
              marginBottom: "24px",
            }}
          >
            {/* Left: Interactive Window Meter */}
            <div
              style={{
                background: "rgba(10, 13, 22, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "14px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>
                  Sliding 10,000-Block Signing Window
                </div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: isJailed
                      ? "rgba(244, 63, 94, 0.2)"
                      : "rgba(16, 185, 129, 0.2)",
                    color: isJailed ? "#fda4af" : "#34d399",
                    fontWeight: 700,
                  }}
                >
                  {isJailed ? "VALIDATOR JAILED" : "HEALTHY SIGNING"}
                </span>
              </div>

              {/* Signing Percentage Bar */}
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8rem",
                    marginBottom: "6px",
                  }}
                >
                  <span style={{ color: "#94a3b8" }}>
                    Signed Blocks in Window:
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 800,
                      color: Number(signingRate) < 50 ? "#f43f5e" : "#10b981",
                    }}
                  >
                    {signedBlocks.toLocaleString()} / 10,000 ({signingRate}%)
                  </span>
                </div>

                <div
                  style={{
                    position: "relative",
                    height: "22px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "6px",
                    overflow: "visible",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${signingRate}%`,
                      background:
                        Number(signingRate) < 50
                          ? "linear-gradient(90deg, #f43f5e, #f59e0b)"
                          : "linear-gradient(90deg, #10b981, #06b6d4)",
                      borderRadius: "5px",
                      transition: "width 0.3s ease",
                    }}
                  />

                  {/* 50% Threshold Marker */}
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "-6px",
                      bottom: "-6px",
                      width: "2px",
                      background: "#f43f5e",
                      boxShadow: "0 0 6px #f43f5e",
                      zIndex: 3,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "-20px",
                        transform: "translateX(-50%)",
                        fontSize: "0.68rem",
                        color: "#fda4af",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        background: "rgba(0,0,0,0.8)",
                        padding: "1px 4px",
                        borderRadius: "3px",
                      }}
                    >
                      50% Slashing Threshold
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation Controls */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginTop: "6px",
                }}
              >
                <button
                  className="sim-btn"
                  onClick={() => advanceDowntime(1000)}
                  disabled={isJailed}
                >
                  Miss 1,000 Blocks
                </button>
                <button
                  className="sim-btn danger"
                  onClick={() => advanceDowntime(5500)}
                  disabled={isJailed}
                >
                  ⚠️ Miss 5,500 Blocks (Cross 50%)
                </button>
                {isJailed && (
                  <button
                    className="sim-btn primary"
                    onClick={unjailValidator}
                  >
                    <Unlock size={14} /> Submit chain99d tx unjail
                  </button>
                )}
                <button className="sim-btn" onClick={resetDowntime}>
                  <RotateCcw size={14} /> Reset
                </button>
              </div>

              {/* Telemetry Numbers */}
              <div
                style={{
                  background: "rgba(0,0,0,0.4)",
                  padding: "12px",
                  borderRadius: "10px",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.78rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Validator Stake:</span>
                  <span style={{ color: isSlashed01 ? "#f59e0b" : "#fff" }}>
                    {downtimeStake.toLocaleString()} C99{" "}
                    {isSlashed01 && "(0.1% slashed)"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Jail Status:</span>
                  <span style={{ color: isJailed ? "#f43f5e" : "#10b981" }}>
                    {isJailed
                      ? "Jailed (Excluded from Consensus Round-Robin)"
                      : "Active in ValSet"}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Technical Explanation */}
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "14px",
                padding: "20px",
                fontSize: "0.85rem",
                color: "#cbd5e1",
                lineHeight: 1.6,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>
                ⚙️ Downtime Protocol Specifications
              </div>
              <p>
                In CometBFT PoS, consensus liveness requires active participation.
                Validators that crash, experience network outages, or drop offline
                are tracked via a circular bitmap buffer:
              </p>
              <ul style={{ paddingLeft: "18px", fontSize: "0.8rem", color: "#94a3b8" }}>
                <li>
                  <strong style={{ color: "#fff" }}>Tracking Window:</strong> 10,000 continuous blocks (~3.8 hours at 1.4s/block).
                </li>
                <li>
                  <strong style={{ color: "#fff" }}>Minimum Signing Threshold:</strong> 50% (Must sign ≥ 5,000 blocks).
                </li>
                <li>
                  <strong style={{ color: "#fff" }}>Penalty:</strong> 0.1% bonded stake slashed immediately.
                </li>
                <li>
                  <strong style={{ color: "#fff" }}>Jailing:</strong> Suspended from the active consensus set. To return, the operator must restart the node and send an <code>unjail</code> transaction.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: UNBONDING & HISTORICAL SLASHING ───────────────── */}
      {activeTab === "unbonding" && (
        <div>
          <div
            style={{
              background: "rgba(10, 13, 22, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "14px",
              padding: "24px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                fontSize: "1rem",
                fontWeight: 800,
                color: "#fff",
                marginBottom: "8px",
              }}
            >
              14-Day Unbonding Queue & Anti-Flash-Loan Protection
            </div>
            <p
              style={{
                fontSize: "0.86rem",
                color: "#94a3b8",
                lineHeight: 1.6,
                marginBottom: "20px",
              }}
            >
              When a user calls <code>undelegate()</code>, tokens do not unlock
              immediately. They enter a 14-day cryptographic holding queue. This
              prevents flash-loan governance exploits and guarantees that stake
              remains slasheable for past malicious acts.
            </p>

            {/* Visual Timeline Pipeline */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
              }}
            >
              {[
                {
                  day: "Day 0",
                  title: "1. Delegation Active",
                  desc: "Earning block rewards; voting power backing consensus.",
                  accent: "#6366f1",
                },
                {
                  day: "Day 0 (Request)",
                  title: "2. Undelegate Invoked",
                  desc: "Shares converted to unbonding entry in x/staking. Rewards cease.",
                  accent: "#06b6d4",
                },
                {
                  day: "Days 1 — 14",
                  title: "3. Time-Lock Window",
                  desc: "Locked in protocol memory. Cannot be transferred or traded.",
                  accent: "#f59e0b",
                },
                {
                  day: "Historical Check",
                  title: "4. Slashing Exposure",
                  desc: "If validator double-signed while you were bonded, tokens are STILL slashed!",
                  accent: "#f43f5e",
                },
                {
                  day: "Day 14+",
                  title: "5. Liquid Tokens Released",
                  desc: "Principal returned to liquid balance in x/bank module.",
                  accent: "#10b981",
                },
              ].map((phase, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${phase.accent}40`,
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: phase.accent,
                      textTransform: "uppercase",
                    }}
                  >
                    {phase.day}
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      color: "#fff",
                      margin: "4px 0",
                    }}
                  >
                    {phase.title}
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "#94a3b8" }}>
                    {phase.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

