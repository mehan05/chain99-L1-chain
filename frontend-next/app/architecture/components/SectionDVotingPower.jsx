"use client";

import { useState } from "react";
import {
  Sliders,
  Power,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldAlert,
  Zap,
  Info,
} from "lucide-react";

export default function SectionDVotingPower() {
  const [stakes, setStakes] = useState({
    1: 10000,
    2: 15000,
    3: 20000,
    4: 25000,
  });

  const [onlineStatus, setOnlineStatus] = useState({
    1: true,
    2: true,
    3: true,
    4: true,
  });

  // Mathematical derivations
  const totalStake = stakes[1] + stakes[2] + stakes[3] + stakes[4];
  const quorumThreshold = (totalStake * 2) / 3; // > 2/3 total

  const onlineStake = Object.entries(stakes).reduce((acc, [id, stake]) => {
    return onlineStatus[id] ? acc + stake : acc;
  }, 0);

  const canReachQuorum = onlineStake > quorumThreshold;
  const onlinePercentage = totalStake > 0 ? ((onlineStake / totalStake) * 100).toFixed(1) : "0";

  // Handlers
  const handleStakeChange = (id, val) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setStakes((prev) => ({ ...prev, [id]: num }));
  };

  const toggleOnline = (id) => {
    setOnlineStatus((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReset = () => {
    setStakes({ 1: 10000, 2: 15000, 3: 20000, 4: 25000 });
    setOnlineStatus({ 1: true, 2: true, 3: true, 4: true });
  };

  const setPreset = (preset) => {
    if (preset === "node4_offline") {
      setStakes({ 1: 10000, 2: 15000, 3: 20000, 4: 25000 });
      setOnlineStatus({ 1: true, 2: true, 3: true, 4: false });
    } else if (preset === "node1_offline") {
      setStakes({ 1: 10000, 2: 15000, 3: 20000, 4: 25000 });
      setOnlineStatus({ 1: false, 2: true, 3: true, 4: true });
    } else if (preset === "equal_stake") {
      setStakes({ 1: 17500, 2: 17500, 3: 17500, 4: 17500 });
      setOnlineStatus({ 1: true, 2: true, 3: true, 4: true });
    } else if (preset === "whale") {
      setStakes({ 1: 5000, 2: 5000, 3: 10000, 4: 50000 });
      setOnlineStatus({ 1: true, 2: true, 3: true, 4: true });
    }
  };

  return (
    <section id="section-voting-power" className="arch-section">
      <div className="arch-section-header">
        <span className="arch-section-tag">
          <Zap size={14} /> Section D — Interactive Calculator
        </span>
        <h2 className="arch-title">Validator Voting Power & Liveness Simulator</h2>
        <p className="arch-subtitle">
          Test real-time Byzantine consensus fault tolerance under asymmetric
          stake distributions. Toggle validators offline to observe whether the
          network can safely reach the strict &gt; 2/3 BFT quorum threshold.
        </p>
      </div>

      {/* Preset Scenario Quick-Bar */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "20px",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: "0.78rem", color: "#94a3b8" }}>Presets:</span>
        <button
          className="sim-btn"
          onClick={handleReset}
          style={{ fontSize: "0.76rem", padding: "4px 10px" }}
        >
          <RotateCcw size={13} /> Default Stakes (70,000 C99)
        </button>
        <button
          className="sim-btn danger"
          onClick={() => setPreset("node4_offline")}
          style={{ fontSize: "0.76rem", padding: "4px 10px" }}
        >
          🚨 Node 4 Offline (Consensus Halts!)
        </button>
        <button
          className="sim-btn"
          onClick={() => setPreset("node1_offline")}
          style={{ fontSize: "0.76rem", padding: "4px 10px" }}
        >
          ✓ Node 1 Offline (Consensus Proceeds)
        </button>
        <button
          className="sim-btn"
          onClick={() => setPreset("equal_stake")}
          style={{ fontSize: "0.76rem", padding: "4px 10px" }}
        >
          ⚖️ Equal Stake (17,500 each)
        </button>
      </div>

      {/* Real-Time Consensus Liveness Outcome Banner */}
      <div
        style={{
          padding: "18px 24px",
          borderRadius: "14px",
          marginBottom: "24px",
          background: canReachQuorum
            ? "rgba(16, 185, 129, 0.12)"
            : "rgba(244, 63, 94, 0.15)",
          border: `1px solid ${
            canReachQuorum
              ? "rgba(16, 185, 129, 0.35)"
              : "rgba(244, 63, 94, 0.45)"
          }`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {canReachQuorum ? (
            <CheckCircle2 size={32} color="#10b981" />
          ) : (
            <ShieldAlert size={32} color="#f43f5e" />
          )}
          <div>
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                color: canReachQuorum ? "#34d399" : "#fda4af",
              }}
            >
              {canReachQuorum
                ? "Consensus Healthy — Quorum Attainable"
                : "CONSENSUS HALTED — Liveness Failure!"}
            </div>
            <div style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
              {canReachQuorum
                ? `Online voting power (${onlineStake.toLocaleString()} C99) exceeds the > 2/3 threshold (${quorumThreshold.toFixed(
                    1
                  )} C99). Blocks commit normally.`
                : `Active online voting power (${onlineStake.toLocaleString()} C99 / ${onlinePercentage}%) is INSUFFICIENT to clear the 2/3 quorum (${quorumThreshold.toFixed(
                    1
                  )} C99). Blockchain stalls until stake goes back online.`}
            </div>
          </div>
        </div>

        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
            ONLINE POWER RATIO
          </div>
          <div
            style={{
              fontSize: "1.4rem",
              fontWeight: 800,
              color: canReachQuorum ? "#10b981" : "#f43f5e",
            }}
          >
            {onlinePercentage}%
          </div>
        </div>
      </div>

      {/* 4 Validator Sliders & Online Toggles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {[1, 2, 3, 4].map((id) => {
          const isOnline = onlineStatus[id];
          const stakeVal = stakes[id];
          const pct = totalStake > 0 ? ((stakeVal / totalStake) * 100).toFixed(1) : "0";

          return (
            <div
              key={id}
              className={`validator-node-box ${!isOnline ? "offline" : ""}`}
              style={{
                border: isOnline
                  ? "1px solid rgba(255,255,255,0.1)"
                  : "1px solid rgba(244, 63, 94, 0.4)",
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
                <div>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>
                    Validator {id}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#94a3b8" }}>
                    Port {26646 + id * 10}
                  </div>
                </div>

                {/* Online / Offline Toggle Button */}
                <button
                  onClick={() => toggleOnline(id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "none",
                    background: isOnline
                      ? "rgba(16, 185, 129, 0.2)"
                      : "rgba(244, 63, 94, 0.2)",
                    color: isOnline ? "#34d399" : "#fda4af",
                  }}
                >
                  <Power size={12} />
                  <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
                </button>
              </div>

              {/* Stake Amount Input */}
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.76rem",
                    color: "#94a3b8",
                    marginBottom: "4px",
                  }}
                >
                  <span>Bonded Stake (C99):</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 700,
                      color: "#06b6d4",
                    }}
                  >
                    {pct}% of network
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1000"
                  value={stakeVal}
                  onChange={(e) => handleStakeChange(id, e.target.value)}
                  style={{
                    width: "100%",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    color: "#fff",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    outline: "none",
                  }}
                />
              </div>

              {/* Slider */}
              <div>
                <input
                  type="range"
                  min="0"
                  max="50000"
                  step="500"
                  value={stakeVal}
                  onChange={(e) => handleStakeChange(id, e.target.value)}
                  className="custom-range-slider"
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.7rem",
                  color: "#64748b",
                  marginTop: "6px",
                }}
              >
                <span>0 C99</span>
                <span>50,000 C99</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Critical Mathematical Insight Box */}
      <div
        style={{
          background: "rgba(10, 13, 22, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          padding: "18px 22px",
          fontSize: "0.85rem",
          color: "#cbd5e1",
          lineHeight: 1.6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#f59e0b",
            fontWeight: 700,
            marginBottom: "6px",
          }}
        >
          <Info size={16} /> Important Engineering Nuance: Asymmetric Stake vs
          Naive Byzantine Tolerance
        </div>
        <p>
          In a classic Proof-of-Authority or equal-weight network with 4 nodes (N = 4), the rule f = floor((N - 1) / 3) = 1 implies the network can survive <strong>any</strong> single node crash. However, in Proof-of-Stake, <strong>voting power is weighted by stake</strong>.
        </p>
        <p style={{ marginTop: "6px" }}>
          In Chain99’s initial devnet distribution, Validator 4 holds <strong>25,000 C99 (35.71%)</strong> of the 70,000 total. Because 35.71% &gt; 33.33%, Validator 4 holds a <em>liveness veto</em>. If Validator 4 goes offline, the remaining 3 nodes possess only 45,000 C99 (&lt; 46,666.67 C99), halting consensus! Conversely, if Validator 1 (10,000 C99 / 14.3%) goes dark, the network effortlessly continues at 85.7% online power.
        </p>
      </div>
    </section>
  );
}
