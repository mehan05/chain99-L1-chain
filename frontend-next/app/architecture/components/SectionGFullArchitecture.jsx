"use client";

import { useState, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Network,
  Cpu,
  Database,
  Radio,
  ShieldAlert,
  Globe,
  Info,
  X,
  ExternalLink,
  Zap,
} from "lucide-react";

const SYSTEM_COMPONENTS = {
  metamask: {
    name: "MetaMask / Web3 Wallets",
    layer: "Client Layer",
    tech: "secp256k1, EIP-1559, Chain ID 9999",
    summary:
      "Browser extension and mobile wallet managing private keys and signing EVM transactions.",
    inputs: "User actions, DApp connection requests",
    outputs: "Signed RLP transactions via eth_sendRawTransaction",
    role: "Signs transfers, smart contract interactions, and staking delegations without exposing private keys.",
  },
  dashboard: {
    name: "Next.js Web Dashboard",
    layer: "Client Layer",
    tech: "Next.js 16, React 19, ethers.js, Port 3000",
    summary:
      "Full mission-control block explorer, faucet dispenser, and contract studio.",
    inputs: "User interaction, live RPC telemetry",
    outputs: "JSON-RPC queries, faucet claims, block inspections",
    role: "Provides real-time visibility into blocks, transactions, and validator sets.",
  },
  hardhat: {
    name: "Hardhat Tooling Suite",
    layer: "Client Layer",
    tech: "Hardhat v2.28, ethers v6",
    summary:
      "Developer smart contract compilation, deployment, and testing pipeline.",
    inputs: "Solidity source files (Storage.sol, C99Staking.sol)",
    outputs: "Deploy transactions, contract test assertions",
    role: "Automated unit and integration testing against local Chain99 devnet.",
  },
  cli: {
    name: "chain99d Daemon CLI",
    layer: "Client Layer",
    tech: "Go CLI, Cobra framework",
    summary:
      "Native binary interface for node operation, validator key creation, and consensus queries.",
    inputs: "Operator commands (tx, query, status, init)",
    outputs: "Signed Cosmos transactions, P2P telemetry",
    role: "Direct operator access for validator staking, unjailing, and genesis configuration.",
  },

  evm_rpc: {
    name: "EVM JSON-RPC Gateway",
    layer: "RPC Layer",
    tech: "Port 8545 (HTTP), go-ethereum RPC server",
    summary:
      "Translates Web3 Ethereum calls (eth_*) into Cosmos ABCI DeliverTx and CheckTx calls.",
    inputs: "eth_sendRawTransaction, eth_call, eth_getBalance, eth_blockNumber",
    outputs: "Hex encoded responses, logs, Bloom filters",
    role: "100% wire-compatible Ethereum interface for tooling and wallets.",
  },
  comet_rpc: {
    name: "CometBFT RPC Gateway",
    layer: "RPC Layer",
    tech: "Port 26657 (HTTP/WS)",
    summary:
      "Exposes consensus telemetry, block header commits, and P2P peer statistics.",
    inputs: "status, net_info, commit, validators, broadcast_tx_sync",
    outputs: "BFT block headers, validator commit signatures, peer lists",
    role: "Consensus inspection and transaction broadcasting for Cosmos clients.",
  },
  cosmos_rest: {
    name: "Cosmos REST & gRPC",
    layer: "RPC Layer",
    tech: "Port 1317 (REST), Port 9090 (gRPC Protobuf)",
    summary:
      "Standard Cosmos SDK gRPC gateway exposing staking, slashing, and bank module endpoints.",
    inputs: "/cosmos/staking/v1beta1/validators, /cosmos/bank/v1beta1/balances",
    outputs: "Protobuf/JSON data for validator pools and token supplies",
    role: "Authoritative Cosmos state inspection for explorers and indexers.",
  },

  evm_engine: {
    name: "Cosmos EVM Engine",
    layer: "Execution Layer",
    tech: "v20.0.0, core/vm, EIP-1559 base fee burn",
    summary:
      "Deterministic EVM bytecode executor embedded in Cosmos ABCI application lifecycle.",
    inputs: "DeliverTx batches, StateDB world state",
    outputs: "State transitions, gas metering, execution receipts, logs",
    role: "Executes Solidity opcodes with zero difference from Ethereum mainnet.",
  },
  staking_precompile: {
    name: "EVM Staking Precompile",
    layer: "Execution Layer",
    tech: "Address 0x000...0800, Native Go memory hook",
    summary:
      "Bridges Solidity smart contract calls directly into Cosmos x/staking keeper.",
    inputs: "delegate(), undelegate(), redelegate() calldata",
    outputs: "Cosmos staking events, updated validator shares",
    role: "Allows MetaMask users to stake directly on Layer 1 without installing Cosmos wallets.",
  },
  statedb: {
    name: "StateDB Storage Engine",
    layer: "Execution Layer",
    tech: "go-ethereum StateDB fork with IAVL backend",
    summary:
      "Maintains Ethereum account nonces, balances, code hashes, and contract storage roots.",
    inputs: "Read/Write opcode calls (SLOAD, SSTORE)",
    outputs: "Merkle trie state roots, storage diffs",
    role: "Ensures atomic EVM state rollback if a transaction reverts.",
  },

  mod_staking: {
    name: "x/staking Module",
    layer: "Cosmos SDK Modules",
    tech: "Cosmos SDK v0.50.9-evmos",
    summary:
      "Authoritative ledger for validator bonded stake, commission rates, and delegator shares.",
    inputs: "Delegate/Undelegate messages from Precompile or CLI",
    outputs: "ValidatorUpdates diff sent to CometBFT in EndBlock",
    role: "Single source of truth for validator set and voting power.",
  },
  mod_slashing: {
    name: "x/slashing Module",
    layer: "Cosmos SDK Modules",
    tech: "Cosmos SDK v0.50.9-evmos",
    summary:
      "Tracks block signing liveness over 10,000 blocks and processes double-signing evidence.",
    inputs: "Missed block bitmaps, CometBFT equivocation evidence",
    outputs: "Stake burn deductions (0.1% or 5.0%), validator jailing/tombstoning",
    role: "Guarantees cryptoeconomic security and punishes offline or Byzantine validators.",
  },
  mod_bank: {
    name: "x/bank Module",
    layer: "Cosmos SDK Modules",
    tech: "Multi-asset token keeper (ac99)",
    summary:
      "Authoritative balance ledger for native C99 currency (base ac99).",
    inputs: "Send, Mint, Burn calls from EVM and SDK",
    outputs: "Balance queries, supply caps (2,000,000 C99 genesis cap)",
    role: "Ensures total token supply invariant and handles multi-asset balances.",
  },

  comet_mempool: {
    name: "CometBFT Mempool",
    layer: "Consensus Layer",
    tech: "CometBFT v0.38.12 Reactor",
    summary:
      "Pending transaction queue verified via ABCI CheckTx before block inclusion.",
    inputs: "Incoming transactions from EVM JSON-RPC and P2P gossip",
    outputs: "Candidate transaction batches for proposer",
    role: "Prevents spam and prioritizes transactions based on EIP-1559 tips.",
  },
  comet_bft: {
    name: "CometBFT 2-Phase State Machine",
    layer: "Consensus Layer",
    tech: "Propose → Prevote → Precommit → Commit",
    summary:
      "Rounds-based BFT consensus reaching deterministic single-block finality.",
    inputs: "Candidate blocks, Ed25519 signed votes",
    outputs: "Committed block headers with > 2/3 validator quorum",
    role: "Guarantees zero chain reorganizations and deterministic finality.",
  },

  mesh_network: {
    name: "4-Node P2P Validator Mesh",
    layer: "Network Layer",
    tech: "TCP Gossip on ports 26656, 26666, 26676, 26686",
    summary:
      "Decentralized peer mesh topology connecting all 4 independent validator daemons.",
    inputs: "Block parts, consensus votes, mempool transactions",
    outputs: "Network-wide state synchronization",
    role: "Robust P2P communications with isolated consensus key storage per node.",
  },

  persistent_storage: {
    name: "IAVL+ & LevelDB Store",
    layer: "Storage Layer",
    tech: "GoLevelDB / RocksDB, IAVL Immutable Tree",
    summary:
      "Permanent cryptographic on-disk storage holding application state and block history.",
    inputs: "ABCI Commit state diffs, finalized block headers",
    outputs: "Historical block data, Merkle proofs",
    role: "Immutable persistence and tamper-proof verification of all historic state.",
  },
};

export default function SectionGFullArchitecture() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeFlow, setActiveFlow] = useState("all"); // 'all' | 'tx' | 'consensus' | 'staking' | 'slashing'
  const [selectedCompKey, setSelectedCompKey] = useState(null);

  const containerRef = useRef(null);

  // Pan controls
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(1.5, z + 0.15));
  const handleZoomOut = () => setZoom((z) => Math.max(0.65, z - 0.15));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const selectedComp = selectedCompKey ? SYSTEM_COMPONENTS[selectedCompKey] : null;

  return (
    <section id="section-full-architecture" className="arch-section">
      <div className="arch-section-header">
        <span className="arch-section-tag" style={{ color: "#38bdf8" }}>
          <Zap size={14} /> Section G — Comprehensive Architecture Map
        </span>
        <h2 className="arch-title">Full System Architecture Diagram</h2>
        <p className="arch-subtitle">
          An interactive, zoomable and pannable system blueprint mapping the
          entire end-to-end topology: Client Layer, RPC Gateways, Cosmos EVM,
          Cosmos SDK Modules, CometBFT Consensus, P2P Network, and Persistent
          Storage.
        </p>
      </div>

      {/* Flow Filter Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: "0.78rem",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              marginRight: "6px",
            }}
          >
            Highlight Flow:
          </span>
          {[
            { id: "all", label: "All Pathways" },
            { id: "tx", label: "⚡ Transaction Flow" },
            { id: "consensus", label: "🛡️ CometBFT Consensus" },
            { id: "staking", label: "🌱 Staking Precompile" },
            { id: "slashing", label: "🔥 Slashing & Evidence" },
          ].map((f) => (
            <button
              key={f.id}
              className={`sim-speed-btn ${activeFlow === f.id ? "active" : ""}`}
              onClick={() => setActiveFlow(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
          💡 Drag to pan • Scroll / use buttons to zoom • Click any node to inspect
        </div>
      </div>

      {/* Interactive Canvas Container */}
      <div
        className="canvas-wrapper"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {/* Canvas Toolbar */}
        <div className="canvas-toolbar">
          <button className="canvas-btn" onClick={handleZoomIn} title="Zoom In">
            <ZoomIn size={15} />
          </button>
          <button className="canvas-btn" onClick={handleZoomOut} title="Zoom Out">
            <ZoomOut size={15} />
          </button>
          <button className="canvas-btn" onClick={handleResetView} title="Reset View">
            <RotateCcw size={15} />
          </button>
          <span
            style={{
              fontSize: "0.74rem",
              padding: "4px 8px",
              color: "#94a3b8",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Scalable Pannable Canvas */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            padding: "40px",
            minWidth: "1200px",
          }}
        >
          {/* TIER 1: CLIENT LAYER */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#6366f1",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              1. Client & Application Layer
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              {["metamask", "dashboard", "hardhat", "cli"].map((k) => {
                const comp = SYSTEM_COMPONENTS[k];
                const isSelected = selectedCompKey === k;
                return (
                  <div
                    key={k}
                    onClick={() => setSelectedCompKey(k)}
                    style={{
                      flex: 1,
                      minWidth: "220px",
                      background: isSelected
                        ? "rgba(99, 102, 241, 0.25)"
                        : "rgba(18, 22, 34, 0.85)",
                      border: `1px solid ${
                        isSelected ? "#6366f1" : "rgba(255, 255, 255, 0.08)"
                      }`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 0 16px rgba(99, 102, 241, 0.3)"
                        : "none",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>
                      {comp.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {comp.tech}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CONNECTOR ARROWS 1 -> 2 */}
          <div
            style={{
              textAlign: "center",
              color:
                activeFlow === "tx" || activeFlow === "all"
                  ? "#06b6d4"
                  : "#334155",
              fontSize: "0.75rem",
              margin: "-18px 0 14px 0",
              fontWeight: 700,
            }}
          >
            ↓ JSON-RPC 2.0 & gRPC Handshakes ↓
          </div>

          {/* TIER 2: RPC LAYER */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#06b6d4",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              2. Interface & Gateways
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              {["evm_rpc", "comet_rpc", "cosmos_rest"].map((k) => {
                const comp = SYSTEM_COMPONENTS[k];
                const isSelected = selectedCompKey === k;
                return (
                  <div
                    key={k}
                    onClick={() => setSelectedCompKey(k)}
                    style={{
                      flex: 1,
                      minWidth: "260px",
                      background: isSelected
                        ? "rgba(6, 182, 212, 0.25)"
                        : "rgba(18, 22, 34, 0.85)",
                      border: `1px solid ${
                        isSelected ? "#06b6d4" : "rgba(255, 255, 255, 0.08)"
                      }`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 0 16px rgba(6, 182, 212, 0.3)"
                        : "none",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>
                      {comp.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {comp.tech}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CONNECTOR ARROWS 2 -> 3 */}
          <div
            style={{
              textAlign: "center",
              color:
                activeFlow === "staking" || activeFlow === "tx" || activeFlow === "all"
                  ? "#a855f7"
                  : "#334155",
              fontSize: "0.75rem",
              margin: "-18px 0 14px 0",
              fontWeight: 700,
            }}
          >
            ↓ DeliverTx & Staking Precompile Dispatches ↓
          </div>

          {/* TIER 3: STATE MACHINE & EXECUTION */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#a855f7",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              3. Execution Engine & Cosmos SDK Native Modules
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              {[
                "evm_engine",
                "staking_precompile",
                "statedb",
                "mod_staking",
                "mod_slashing",
                "mod_bank",
              ].map((k) => {
                const comp = SYSTEM_COMPONENTS[k];
                const isSelected = selectedCompKey === k;
                return (
                  <div
                    key={k}
                    onClick={() => setSelectedCompKey(k)}
                    style={{
                      flex: 1,
                      minWidth: "170px",
                      background: isSelected
                        ? "rgba(168, 85, 247, 0.25)"
                        : "rgba(18, 22, 34, 0.85)",
                      border: `1px solid ${
                        isSelected ? "#a855f7" : "rgba(255, 255, 255, 0.08)"
                      }`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 0 16px rgba(168, 85, 247, 0.3)"
                        : "none",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>
                      {comp.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {comp.tech}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CONNECTOR ARROWS 3 -> 4 */}
          <div
            style={{
              textAlign: "center",
              color:
                activeFlow === "consensus" || activeFlow === "all"
                  ? "#f59e0b"
                  : "#334155",
              fontSize: "0.75rem",
              margin: "-18px 0 14px 0",
              fontWeight: 700,
            }}
          >
            ↓ ABCI ProcessProposal & EndBlock: ValidatorUpdates ↓
          </div>

          {/* TIER 4: CONSENSUS & NETWORK */}
          <div style={{ marginBottom: "32px" }}>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#f59e0b",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              4. CometBFT Consensus & 4-Node P2P Validator Network
            </div>
            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              {["comet_mempool", "comet_bft", "mesh_network"].map((k) => {
                const comp = SYSTEM_COMPONENTS[k];
                const isSelected = selectedCompKey === k;
                return (
                  <div
                    key={k}
                    onClick={() => setSelectedCompKey(k)}
                    style={{
                      flex: 1,
                      minWidth: "260px",
                      background: isSelected
                        ? "rgba(245, 158, 11, 0.25)"
                        : "rgba(18, 22, 34, 0.85)",
                      border: `1px solid ${
                        isSelected ? "#f59e0b" : "rgba(255, 255, 255, 0.08)"
                      }`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 0 16px rgba(245, 158, 11, 0.3)"
                        : "none",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>
                      {comp.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {comp.tech}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TIER 5: PERSISTENT STORAGE */}
          <div>
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#10b981",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              5. Permanent Authenticated Storage
            </div>
            <div style={{ display: "flex", gap: "14px" }}>
              {["persistent_storage"].map((k) => {
                const comp = SYSTEM_COMPONENTS[k];
                const isSelected = selectedCompKey === k;
                return (
                  <div
                    key={k}
                    onClick={() => setSelectedCompKey(k)}
                    style={{
                      flex: 1,
                      background: isSelected
                        ? "rgba(16, 185, 129, 0.25)"
                        : "rgba(18, 22, 34, 0.85)",
                      border: `1px solid ${
                        isSelected ? "#10b981" : "rgba(255, 255, 255, 0.08)"
                      }`,
                      borderRadius: "10px",
                      padding: "12px 14px",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 0 16px rgba(16, 185, 129, 0.3)"
                        : "none",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff" }}>
                      {comp.name}
                    </div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "#94a3b8",
                        marginTop: "2px",
                      }}
                    >
                      {comp.tech}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Component Modal / Drawer */}
      {selectedComp && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            width: "380px",
            maxWidth: "calc(100vw - 48px)",
            background: "rgba(12, 16, 28, 0.98)",
            border: "1px solid rgba(6, 182, 212, 0.4)",
            borderRadius: "16px",
            padding: "20px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(20px)",
            zIndex: 100,
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
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  color: "#06b6d4",
                  textTransform: "uppercase",
                }}
              >
                {selectedComp.layer}
              </span>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#fff" }}>
                {selectedComp.name}
              </div>
            </div>
            <button
              onClick={() => setSelectedCompKey(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            style={{
              fontSize: "0.82rem",
              color: "#cbd5e1",
              lineHeight: 1.5,
              marginBottom: "12px",
            }}
          >
            {selectedComp.summary}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "10px",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.72rem",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div>
              <span style={{ color: "#94a3b8" }}>Tech: </span>
              <span style={{ color: "#06b6d4" }}>{selectedComp.tech}</span>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Role: </span>
              <span style={{ color: "#fff" }}>{selectedComp.role}</span>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Inputs: </span>
              <span style={{ color: "#a5b4fc" }}>{selectedComp.inputs}</span>
            </div>
            <div>
              <span style={{ color: "#94a3b8" }}>Outputs: </span>
              <span style={{ color: "#10b981" }}>{selectedComp.outputs}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

