"use client";

import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  ShieldCheck,
  CheckCircle2,
  Users,
  Vote,
  Sparkles,
  Zap,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

const INITIAL_VALIDATORS = [
  {
    id: 1,
    name: "Validator 1",
    moniker: "validator1",
    stake: 10000,
    port: 26656,
    accent: "#6366f1",
  },
  {
    id: 2,
    name: "Validator 2",
    moniker: "validator2",
    stake: 15000,
    port: 26666,
    accent: "#06b6d4",
  },
  {
    id: 3,
    name: "Validator 3",
    moniker: "validator3",
    stake: 20000,
    port: 26676,
    accent: "#8b5cf6",
  },
  {
    id: 4,
    name: "Validator 4",
    moniker: "validator4",
    stake: 25000,
    port: 26686,
    accent: "#10b981",
  },
];

const TOTAL_POWER = 70000;
const QUORUM_THRESHOLD = 46666.67; // > 2/3 of 70,000

const PHASES = [
  {
    id: 1,
    name: "Phase 1: Proposer",
    tag: "PROPOSE",
    title: "Proposer Broadcasts Candidate Block",
    desc: "Validator 4 is selected as the round proposer via CometBFT's stake-weighted round-robin algorithm. It packages mempool transactions into candidate Block #294 and gossips the proposal to all peers.",
  },
  {
    id: 2,
    name: "Phase 2: Prevote",
    tag: "PREVOTE",
    title: "Validators Broadcast Prevote Messages",
    desc: "Each validator executes ABCI ProcessProposal, verifies transaction integrity, and broadcasts a signed PREVOTE. When accumulated prevotes exceed > 2/3 voting power (46,666.67 C99), a consensus Polka is formed.",
  },
  {
    id: 3,
    name: "Phase 3: Precommit",
    tag: "PRECOMMIT",
    title: "Validators Broadcast Precommit Messages",
    desc: "Having observed the Polka, validators lock onto Block #294 and broadcast signed PRECOMMIT messages. Reaching > 2/3 precommit signatures locks the block for irreversible commitment.",
  },
  {
    id: 4,
    name: "Phase 4: Commit",
    tag: "COMMIT",
    title: "Deterministic Block Commitment & Finality",
    desc: "The block is committed into the persistent database. Height advances from #294 to #295. Deterministic single-block finality is achieved without any possibility of chain reorganization.",
  },
];

export default function SectionCConsensus() {
  const [phase, setPhase] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [blockHeight, setBlockHeight] = useState(294);
  const [votesCast, setVotesCast] = useState({
    1: false,
    2: false,
    3: false,
    4: false,
  });

  const timerRef = useRef(null);

  // Progressive voting power accumulation in Phase 2 and 3
  const [accumulatedPower, setAccumulatedPower] = useState(0);

  // When phase changes, calculate vote progression
  useEffect(() => {
    if (phase === 1) {
      setVotesCast({ 1: false, 2: false, 3: false, 4: false });
      setAccumulatedPower(0);
    } else if (phase === 2 || phase === 3) {
      // Simulate all 4 validators voting
      setVotesCast({ 1: true, 2: true, 3: true, 4: true });
      setAccumulatedPower(TOTAL_POWER);
    } else if (phase === 4) {
      setVotesCast({ 1: true, 2: true, 3: true, 4: true });
      setAccumulatedPower(TOTAL_POWER);
      setBlockHeight(295);
    }
  }, [phase]);

  // Automated playback timer
  useEffect(() => {
    if (isPlaying) {
      const duration = 3500 / speed;
      timerRef.current = setTimeout(() => {
        setPhase((prev) => {
          if (prev >= 4) {
            setIsPlaying(false);
            return 4;
          }
          return prev + 1;
        });
      }, duration);
    }
    return () => clearTimeout(timerRef.current);
  }, [isPlaying, phase, speed]);

  const activePhase = PHASES[phase - 1];
  const quorumPercent = ((accumulatedPower / TOTAL_POWER) * 100).toFixed(1);
  const hasQuorum = accumulatedPower > QUORUM_THRESHOLD;

  const handlePlay = () => {
    if (phase >= 4 && !isPlaying) {
      setPhase(1);
      setBlockHeight(294);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    setPhase(1);
    setBlockHeight(294);
    setVotesCast({ 1: false, 2: false, 3: false, 4: false });
    setAccumulatedPower(0);
  };

  const handleNext = () => {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    if (phase < 4) setPhase((p) => p + 1);
  };

  const handlePrev = () => {
    setIsPlaying(false);
    clearTimeout(timerRef.current);
    if (phase > 1) {
      setPhase((p) => p - 1);
      if (phase === 4) setBlockHeight(294);
    }
  };

  return (
    <section id="section-consensus" className="arch-section">
      <div className="arch-section-header">
        <span className="arch-section-tag">
          <Zap size={14} /> Section C — Consensus Protocol
        </span>
        <h2 className="arch-title">Detailed CometBFT Consensus Visualization</h2>
        <p className="arch-subtitle">
          Experience the 2-phase Byzantine Fault Tolerant state machine in
          action. Watch how proposal, prevote, precommit, and commit phases
          guarantee single-block finality with mathematical quorum enforcement.
        </p>
      </div>

      {/* Simulator Control Bar */}
      <div className="sim-toolbar">
        <div className="sim-btn-group">
          <button className="sim-btn primary" onClick={handlePlay}>
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            <span>{isPlaying ? "Pause" : phase === 4 ? "Re-run Consensus" : "Start Consensus"}</span>
          </button>

          <button
            className="sim-btn"
            onClick={handlePrev}
            disabled={phase === 1}
          >
            <SkipBack size={15} /> Prev Phase
          </button>

          <button
            className="sim-btn"
            onClick={handleNext}
            disabled={phase === 4}
          >
            Next Phase <SkipForward size={15} />
          </button>

          <button className="sim-btn" onClick={handleReset}>
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
            {activePhase.tag} PHASE
          </div>
        </div>
      </div>

      {/* Live Quorum Bar */}
      <div className="quorum-progress-container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Vote size={18} color="#06b6d4" /> Cumulative Voting Power
            </span>
            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              Active Phase:{" "}
              <strong style={{ color: "#06b6d4" }}>{activePhase.name}</strong>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
              {accumulatedPower.toLocaleString()} / {TOTAL_POWER.toLocaleString()} C99
            </span>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: "6px",
                background: hasQuorum
                  ? "rgba(16, 185, 129, 0.2)"
                  : "rgba(245, 158, 11, 0.2)",
                color: hasQuorum ? "#34d399" : "#fbbf24",
                border: `1px solid ${
                  hasQuorum
                    ? "rgba(16, 185, 129, 0.4)"
                    : "rgba(245, 158, 11, 0.4)"
                }`,
              }}
            >
              {hasQuorum ? "QUORUM (> 2/3) REACHED" : "AWAITING QUORUM"}
            </span>
          </div>
        </div>

        {/* Progress Track with 2/3 Marker */}
        <div className="quorum-bar-track">
          <div
            className={`quorum-bar-fill ${hasQuorum ? "success" : ""}`}
            style={{ width: `${(accumulatedPower / TOTAL_POWER) * 100}%` }}
          />

          {/* 2/3 Quorum Marker (66.67%) */}
          <div
            className="quorum-threshold-marker"
            style={{ left: "66.67%" }}
          >
            <div className="quorum-threshold-label">
              Quorum Threshold: &gt; 46,666.67 C99 (66.7%)
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.72rem",
            color: "#64748b",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <span>0 C99 (0%)</span>
          <span style={{ color: "#f59e0b" }}>
            2/3 Polka Barrier = 46,667 C99
          </span>
          <span>70,000 C99 (100%)</span>
        </div>
      </div>

      {/* 4 Validator Interactive Nodes */}
      <div className="validators-grid">
        {INITIAL_VALIDATORS.map((val) => {
          const isProposer = val.id === 4;
          const hasVoted = votesCast[val.id];
          const powerPct = ((val.stake / TOTAL_POWER) * 100).toFixed(1);

          return (
            <div
              key={val.id}
              className={`validator-node-box ${
                isProposer && phase === 1
                  ? "proposer"
                  : phase === 2 && hasVoted
                  ? "prevoted"
                  : phase >= 3 && hasVoted
                  ? "precommitted"
                  : ""
              }`}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>
                  {val.name}
                </div>
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: `${val.accent}20`,
                    color: val.accent,
                    border: `1px solid ${val.accent}40`,
                  }}
                >
                  Port {val.port}
                </span>
              </div>

              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                  marginBottom: "10px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>Voting Power:</span>
                <strong style={{ color: "#fff" }}>
                  {val.stake.toLocaleString()} C99 ({powerPct}%)
                </strong>
              </div>

              {/* Status Message per Phase */}
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-mono, monospace)",
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                {phase === 1 && (
                  <div>
                    {isProposer ? (
                      <span style={{ color: "#f59e0b", fontWeight: 700 }}>
                        ★ PROPOSER: Broadcasts Block #{blockHeight}
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>
                        Waiting for candidate block...
                      </span>
                    )}
                  </div>
                )}

                {phase === 2 && (
                  <div style={{ color: "#06b6d4" }}>
                    ✓ Cast PREVOTE: +{val.stake.toLocaleString()} power
                  </div>
                )}

                {phase === 3 && (
                  <div style={{ color: "#10b981" }}>
                    ✓ Cast PRECOMMIT: Lock Block #{blockHeight}
                  </div>
                )}

                {phase === 4 && (
                  <div style={{ color: "#34d399", fontWeight: 700 }}>
                    ★ Block #{blockHeight - 1} Committed to LevelDB
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase Explanation & Outcome Banner */}
      <div
        style={{
          background:
            phase === 4
              ? "rgba(16, 185, 129, 0.1)"
              : "rgba(10, 13, 22, 0.9)",
          border: `1px solid ${
            phase === 4
              ? "rgba(16, 185, 129, 0.4)"
              : "rgba(255, 255, 255, 0.08)"
          }`,
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: phase === 4 ? "#10b981" : "#fff",
            fontSize: "1.1rem",
            fontWeight: 800,
          }}
        >
          {phase === 4 ? (
            <CheckCircle2 size={24} color="#10b981" />
          ) : (
            <ShieldCheck size={24} color="#06b6d4" />
          )}
          <span>{activePhase.title}</span>
        </div>

        <p style={{ fontSize: "0.88rem", color: "#cbd5e1", lineHeight: 1.6 }}>
          {activePhase.desc}
        </p>

        {phase === 4 && (
          <div
            style={{
              marginTop: "8px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              fontSize: "0.8rem",
              color: "#34d399",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Sparkles size={16} />
            <span>
              <strong>Deterministic Finality Guarantee:</strong> CometBFT
              ensures reorgs are impossible without a 1/3+ validator double-sign.
              Block #{blockHeight - 1} is now immutable across all nodes.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

