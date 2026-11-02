"use client";

import { useState } from "react";
import {
  Code2,
  Cpu,
  ShieldCheck,
  Binary,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  Key,
  Users,
  CheckCircle,
  Zap,
} from "lucide-react";

const PRECOMPILE_FLOW = [
  {
    step: 1,
    id: "metamask",
    name: "1. MetaMask / User Client",
    icon: Code2,
    accent: "#6366f1",
    summary: "Alice initiates a delegation from her Web3 wallet interface.",
    details:
      "Alice calls IStakingPrecompile.delegate(delegatorAddress, validatorAddress, 100 * 10^18) using standard Ethereum RPC signing.",
  },
  {
    step: 2,
    id: "solidity_tx",
    name: "2. Solidity Transaction",
    icon: Binary,
    accent: "#8b5cf6",
    summary: "Packed into an EVM transaction targeted at 0x...0800.",
    details:
      "Target address: 0x0000000000000000000000000000000000000800. Gas limit and calldata payload are signed by Alice's secp256k1 key.",
  },
  {
    step: 3,
    id: "precompile",
    name: "3. EVM Staking Precompile",
    icon: Cpu,
    accent: "#06b6d4",
    summary: "Native compiled Go hook intercepted by Cosmos EVM.",
    details:
      "This is NOT a deployed Solidity contract! It is native Go code embedded inside the Cosmos EVM engine that executes at machine speed without EVM gas opcode overhead.",
  },
  {
    step: 4,
    id: "calldata_decode",
    name: "4. Calldata Decoding",
    icon: Layers,
    accent: "#a855f7",
    summary: "Unpacks function selector and parameters in Go runtime.",
    details:
      "Decodes the 4-byte method selector for delegate() and unpacks delegator address, validator address string, and big.Int token amount.",
  },
  {
    step: 5,
    id: "auth_check",
    name: "5. Authorization Check",
    icon: ShieldCheck,
    accent: "#ec4899",
    summary: "Strict verification that caller owns delegator funds.",
    details:
      "Verifies msg.sender == delegatorAddress. A smart contract or external user cannot manipulate or delegate tokens on behalf of another address without signature authorization.",
  },
  {
    step: 6,
    id: "bech32_conversion",
    name: "6. EVM Address → Cosmos Bech32",
    icon: Key,
    accent: "#f59e0b",
    summary: "Translates 20-byte hex to Cosmos c991... and c99valoper1...",
    details:
      "Converts Ethereum hex address (0x86fc...) into Cosmos Bech32 account format (c991...) and validates the validator operator format (c99valoper1...).",
  },
  {
    step: 7,
    id: "keeper_call",
    name: "7. Cosmos x/staking Keeper",
    icon: Database,
    accent: "#10b981",
    summary: "Direct Go memory call into staking keeper state.",
    details:
      "Invokes k.stakingKeeper.Delegate(ctx, delegatorAddr, amount, validator). Deducts 100 C99 from bank balance and mints delegation shares.",
  },
  {
    step: 8,
    id: "delegation_state",
    name: "8. Delegation State Updated",
    icon: CheckCircle,
    accent: "#38bdf8",
    summary: "Validator bonded stake increments immediately.",
    details:
      "Validator 2 bonded pool increases by +100 C99 (from 15,000 to 15,100 C99). Cosmos staking events and EVM logs are emitted.",
  },
  {
    step: 9,
    id: "endblock",
    name: "9. EndBlock Validator Updates",
    icon: Zap,
    accent: "#f97316",
    summary: "ABCI EndBlock collects validator set power diffs.",
    details:
      "At block completion, Cosmos SDK calculates ValidatorUpdates diff array and sends it to CometBFT via ABCI ResponseEndBlock.",
  },
  {
    step: 10,
    id: "cometbft_valset",
    name: "10. CometBFT Validator Set Updated",
    icon: Users,
    accent: "#22c55e",
    summary: "Consensus engine updates voting power for next block.",
    details:
      "CometBFT adjusts Validator 2 voting power to 15,100. Round-robin proposer selection and prevote/precommit weights reflect the new stake.",
  },
];

export default function SectionEStakingPrecompile() {
  const [selectedStep, setSelectedStep] = useState(3); // Default to Precompile
  const [delegationSimulated, setDelegationSimulated] = useState(false);
  const [activeConceptTab, setActiveConceptTab] = useState("keys");

  const currentStep = PRECOMPILE_FLOW[selectedStep - 1];
  const StepIcon = currentStep.icon;

  const toggleDelegationSim = () => {
    setDelegationSimulated(!delegationSimulated);
  };

  return (
    <section id="section-precompile" className="arch-section">
      <div className="arch-section-header">
        <span className="arch-section-tag">
          <Zap size={14} /> Section E — EVM & Cosmos Staking Bridge
        </span>
        <h2 className="arch-title">Staking & EVM Precompile Architecture</h2>
        <p className="arch-subtitle">
          How Ethereum Solidity transactions interact natively with the Cosmos
          SDK staking state machine via the stateful EVM Precompile at{" "}
          <code style={{ color: "#06b6d4" }}>
            0x0000000000000000000000000000000000000800
          </code>
          .
        </p>
      </div>

      {/* Precompile Distinction Banner */}
      <div
        style={{
          background: "rgba(6, 182, 212, 0.08)",
          border: "1px solid rgba(6, 182, 212, 0.3)",
          borderRadius: "14px",
          padding: "18px 24px",
          marginBottom: "28px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: "rgba(6, 182, 212, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#06b6d4",
            flexShrink: 0,
          }}
        >
          <Cpu size={26} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>
            Native Software Precompile vs Standard Smart Contract
          </div>
          <div style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5 }}>
            The Staking Precompile is <strong>not</strong> an ordinary deployed Solidity contract. It is compiled Go software registered directly inside the Cosmos EVM virtual machine. When a transaction calls <code style={{ color: "#06b6d4" }}>0x000...0800</code>, the EVM yields execution directly to Go runtime keepers in memory, bypassing bytecode interpretation while guaranteeing full EVM ABI compatibility.
          </div>
        </div>
      </div>

      {/* Flowchart Stepper Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "24px",
          marginBottom: "28px",
        }}
      >
        {/* Left: Interactive 10-Step Flow Pipeline */}
        <div>
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#94a3b8",
              marginBottom: "10px",
              textTransform: "uppercase",
            }}
          >
            End-to-End Execution Sequence (Click any step to inspect):
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            {PRECOMPILE_FLOW.map((s) => {
              const isActive = s.step === selectedStep;
              const Icon = s.icon;

              return (
                <div
                  key={s.step}
                  className={`flowchart-step-card ${isActive ? "active" : ""}`}
                  onClick={() => setSelectedStep(s.step)}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: `${s.accent}20`,
                        color: s.accent,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          color: isActive ? "#fff" : "#e2e8f0",
                        }}
                      >
                        {s.name}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "180px",
                        }}
                      >
                        {s.summary}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Step Detail Inspector Panel */}
        <div
          style={{
            background: "rgba(10, 13, 22, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "10px",
                  background: `${currentStep.accent}20`,
                  border: `1px solid ${currentStep.accent}50`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: currentStep.accent,
                }}
              >
                <StepIcon size={20} />
              </div>
              <div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: currentStep.accent,
                    textTransform: "uppercase",
                  }}
                >
                  Step {currentStep.step} of 10
                </span>
                <h4 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
                  {currentStep.name}
                </h4>
              </div>
            </div>

            <div
              style={{
                fontSize: "0.9rem",
                color: "#e2e8f0",
                lineHeight: 1.6,
                background: "rgba(255,255,255,0.03)",
                padding: "14px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: "16px",
              }}
            >
              {currentStep.details}
            </div>
          </div>

          {/* Interactive Simulation Action Box */}
          <div
            style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff" }}>
                Interactive Example: Alice Delegates 100 C99
              </span>
              <button
                className="sim-btn primary"
                onClick={toggleDelegationSim}
                style={{ fontSize: "0.72rem", padding: "4px 10px" }}
              >
                {delegationSimulated ? "Reset Example" : "Run Delegation"}
              </button>
            </div>

            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.78rem",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ color: "#94a3b8" }}>
                Target:{" "}
                <span style={{ color: "#06b6d4" }}>
                  Validator 2 (c99valoper1...)
                </span>
              </div>
              <div style={{ color: "#94a3b8" }}>
                Validator 2 Bonded Stake:{" "}
                <strong
                  style={{
                    color: delegationSimulated ? "#10b981" : "#fff",
                    fontSize: "0.95rem",
                  }}
                >
                  {delegationSimulated ? "15,100 C99 (+100)" : "15,000 C99"}
                </strong>
              </div>
              <div style={{ color: "#94a3b8" }}>
                CometBFT Voting Power:{" "}
                <strong
                  style={{
                    color: delegationSimulated ? "#10b981" : "#fff",
                  }}
                >
                  {delegationSimulated ? "15,100 (+100)" : "15,000"}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deep-Dive Architectural Concepts: Key Separation & Roles */}
      <div
        style={{
          background: "rgba(10, 13, 22, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "14px",
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            paddingBottom: "12px",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>
            🔐 Separation of Roles & Cryptographic Keys
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className={`sim-speed-btn ${
                activeConceptTab === "keys" ? "active" : ""
              }`}
              onClick={() => setActiveConceptTab("keys")}
            >
              Key Separation
            </button>
            <button
              className={`sim-speed-btn ${
                activeConceptTab === "roles" ? "active" : ""
              }`}
              onClick={() => setActiveConceptTab("roles")}
            >
              Role Definitions
            </button>
          </div>
        </div>

        {activeConceptTab === "keys" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "14px",
                borderRadius: "10px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#6366f1", fontSize: "0.85rem" }}>
                1. Consensus Key (Ed25519)
              </div>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px" }}>
                Stored in <code>priv_validator_key.json</code>. Used solely by CometBFT daemon for signing prevotes and precommits. Never exposed via RPC or used to spend tokens.
              </p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "14px",
                borderRadius: "10px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#06b6d4", fontSize: "0.85rem" }}>
                2. Operator Key (secp256k1)
              </div>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px" }}>
                Stored in node keyring with <code>c99valoper1...</code> prefix. Used for admin actions: edit-validator, unjail, and commission claims.
              </p>
            </div>

            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "14px",
                borderRadius: "10px",
              }}
            >
              <div style={{ fontWeight: 700, color: "#10b981", fontSize: "0.85rem" }}>
                3. Delegator Key (secp256k1)
              </div>
              <p style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "4px" }}>
                Standard user Ethereum private key in MetaMask (<code>0x...</code> / <code>c991...</code>). Owns tokens and delegates stake to earn protocol rewards.
              </p>
            </div>
          </div>
        )}

        {activeConceptTab === "roles" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              fontSize: "0.82rem",
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              <strong style={{ color: "#fff" }}>Delegator vs Validator Operator:</strong>
              <div style={{ color: "#94a3b8", marginTop: "4px" }}>
                A <strong>Delegator</strong> deposits C99 into a validator’s bonded pool to earn yield without running infrastructure. The <strong>Validator Operator</strong> maintains server hardware, 24/7 uptime, and consensus key security.
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                padding: "12px",
                borderRadius: "8px",
              }}
            >
              <strong style={{ color: "#fff" }}>Voting Power Derivation:</strong>
              <div style={{ color: "#94a3b8", marginTop: "4px" }}>
                Voting power is strictly calculated as floor(Bonded ac99 / 10^18). Delegations increase the validator’s voting power proportionally, enhancing their consensus weight.
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
