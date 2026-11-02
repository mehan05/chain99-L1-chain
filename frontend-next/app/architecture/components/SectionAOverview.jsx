"use client";

import { useState } from "react";
import {
  Globe,
  Radio,
  Cpu,
  Boxes,
  ShieldCheck,
  Network,
  CheckCircle2,
  ArrowDown,
  Info,
  ChevronRight,
  ExternalLink,
  Zap,
} from "lucide-react";

const ARCH_NODES = [
  {
    id: "clients",
    title: "Users / MetaMask / Frontend",
    subtitle: "Web3 wallets, RPC clients, Next.js dApp, hardhat",
    badge: "Client Layer",
    accent: "#6366f1",
    icon: Globe,
    overview:
      "End-user entry points where Ethereum-compatible transactions and queries originate.",
    whyExists:
      "Enables any Web3 user, developer, or automated bot to interact with Chain99 using standard Ethereum tooling without special software.",
    internalWorkings: [
      "User prepares transaction payload (recipient, value in C99, gas parameters).",
      "Signs transaction locally using secp256k1 private key in MetaMask or hardware wallet.",
      "The private key NEVER leaves the client wallet.",
      "Serializes payload into RLP-encoded raw hex and broadcasts via JSON-RPC.",
    ],
    communicatesWith: "RPC Layer (Port 8545 for EVM, Port 26657 for CometBFT)",
    dataFlow:
      "Raw signed EVM transactions (eth_sendRawTransaction), eth_call, eth_getBalance queries.",
    specs: {
      chainId: "9999 (0x270f)",
      cosmosChainId: "chain_9999-1",
      walletCompat: "EIP-155, EIP-1559, MetaMask, Brave, Coinbase Wallet",
    },
  },
  {
    id: "rpc",
    title: "RPC Layer & Gateways",
    subtitle: "EVM JSON-RPC (8545), CometBFT (26657), REST (1317), gRPC (9090)",
    badge: "Interface Layer",
    accent: "#06b6d4",
    icon: Radio,
    overview:
      "Multiplexed gateway translating Ethereum JSON-RPC requests and Cosmos gRPC/REST into internal Go state-machine calls.",
    whyExists:
      "Maintains 100% Ethereum wire compatibility while exposing Cosmos governance, staking, and consensus telemetry.",
    internalWorkings: [
      "Performs syntactic and cryptographic checks: decodes RLP, parses signatures via ecrecover.",
      "Validates intrinsic gas limit and nonces against account state.",
      "Routes EVM transactions directly into the CometBFT mempool.",
      "Serves eth_blockNumber, eth_getBlockByNumber, and event logs from StateDB.",
    ],
    communicatesWith:
      "MetaMask Clients (upstream) ↔ Cosmos EVM & CometBFT Mempool (downstream)",
    dataFlow:
      "JSON-RPC 2.0 requests over HTTP/WebSockets, binary protobuf messages over gRPC.",
    specs: {
      evmRpc: "http://127.0.0.1:8545 (go-ethereum server)",
      cometRpc: "http://127.0.0.1:26657 (BFT queries & gossip status)",
      cosmosRest: "http://127.0.0.1:1317 (x/staking, x/bank REST)",
      cosmosGrpc: "127.0.0.1:9090 (Protobuf v2)",
    },
  },
  {
    id: "evm",
    title: "Cosmos EVM Execution Engine",
    subtitle: "v20.0.0 with full Shanghai/Cancun opcode parity",
    badge: "Execution Layer",
    accent: "#8b5cf6",
    icon: Cpu,
    overview:
      "Embeds go-ethereum's core Virtual Machine directly into Cosmos ABCI application lifecycle.",
    whyExists:
      "Executes Solidity smart contracts and native EVM transactions deterministically across all validator nodes.",
    internalWorkings: [
      "ABCI DeliverTx / ProcessProposal passes batch of transactions to Cosmos EVM.",
      "EVM executes bytecode, reads contract storage from StateDB, and updates gas meter.",
      "Burns EIP-1559 base fee in ac99 to control token supply.",
      "Intercepts calls to address 0x000...0800 and redirects to EVM Staking Precompile.",
      "Generates Bloom filters, transaction receipts, and emission logs.",
    ],
    communicatesWith:
      "StateDB (storage) ↔ EVM Staking Precompile ↔ Cosmos SDK Keeper Modules",
    dataFlow:
      "Bytecode execution traces, StateDB read/write sets, gas refunds, receipt logs.",
    specs: {
      evmVersion: "Cosmos EVM v20.0.0 (Go-Ethereum fork)",
      opcodes: "100% Solidity opcode parity (PUSH0, TLOAD, TSTORE supported)",
      precompileAddress: "0x0000000000000000000000000000000000000800",
    },
  },
  {
    id: "modules",
    title: "Cosmos SDK Native Modules",
    subtitle: "x/staking, x/slashing, x/bank, x/auth, x/distribution",
    badge: "State Machine",
    accent: "#ec4899",
    icon: Boxes,
    overview:
      "Modular state machine providing authoritative accounting for native tokens, validator sets, and slashing rules.",
    whyExists:
      "Decouples consensus, multi-asset banking, and governance logic from EVM execution while remaining the single source of truth.",
    internalWorkings: [
      "x/bank tracks ac99 balances and enforces the 2,000,000 C99 genesis supply cap.",
      "x/staking maintains bonded delegations, validator active set, and commission rates.",
      "x/slashing computes sliding window block-signing downtime and double-signing equivocation.",
      "x/auth verifies account sequences and base fee deductions.",
      "EndBlock hook emits ResponseEndBlock.ValidatorUpdates to CometBFT.",
    ],
    communicatesWith:
      "Cosmos EVM (cross-module keeper calls) ↔ CometBFT ABCI Engine",
    dataFlow:
      "Validator update diffs, bank balance state transitions, slashing evidence execution.",
    specs: {
      sdkVersion: "Cosmos SDK v0.50.9-evmos",
      baseDenom: "ac99 (1 C99 = 10^18 ac99)",
      unbondingPeriod: "14 days time-lock queue",
    },
  },
  {
    id: "consensus",
    title: "CometBFT Consensus Engine",
    subtitle: "v0.38.12 Proof-of-Stake with deterministic 1-block finality",
    badge: "Consensus Layer",
    accent: "#f59e0b",
    icon: ShieldCheck,
    overview:
      "Byzantine Fault Tolerant (BFT) consensus protocol ensuring all honest nodes commit identical block sequences.",
    whyExists:
      "Eliminates probabilistic reorganizations (unlike Proof-of-Work or Nakamoto consensus), guaranteeing immediate finality.",
    internalWorkings: [
      "Proposer elected deterministically using stake-weighted round-robin algorithm.",
      "Proposer bundles transactions from CometBFT mempool and broadcasts candidate block.",
      "Validators verify block via ABCI ProcessProposal and broadcast signed Prevotes.",
      "Upon accumulating > 2/3 voting power prevotes (polka), validators broadcast Precommits.",
      "Upon accumulating > 2/3 voting power precommits, block is committed irrevocably.",
    ],
    communicatesWith:
      "ABCI Application Layer ↔ Peer-to-Peer Validator Mesh Network",
    dataFlow:
      "Candidate blocks, Prevote/Precommit consensus votes, Equivocation evidence packets.",
    specs: {
      engine: "CometBFT v0.38.12",
      finality: "1 Block (Deterministic, ~1.40s block time)",
      faultTolerance: "BFT (N >= 3f + 1, tolerates f Byzantine/crashed nodes)",
    },
  },
  {
    id: "network",
    title: "4-Node Validator Mesh Network",
    subtitle: "P2P peer exchange on ports 26656, 26666, 26676, 26686",
    badge: "Network Layer",
    accent: "#10b981",
    icon: Network,
    overview:
      "Decentralized peer-to-peer gossip network connecting independent validator node instances.",
    whyExists:
      "Provides censorship-resistant transport for block dissemination, transaction propagation, and cryptographic signatures.",
    internalWorkings: [
      "Nodes discover peers via persistent peer list in config.toml.",
      "Mempool reactor gossips unconfirmed transactions across all 4 nodes.",
      "Consensus reactor exchanges proposal parts, prevote signatures, and precommit signatures.",
      "Evidence reactor propagates proof of malicious double-signing for instant slashing.",
    ],
    communicatesWith:
      "Inter-node P2P gossip sockets across Node 1, Node 2, Node 3, and Node 4",
    dataFlow:
      "CometBFT P2P wire packets, protobuf peer handshakes, block parts.",
    specs: {
      topology: "Full mesh P2P local loopback",
      nodes: "Node 1 (26656), Node 2 (26666), Node 3 (26676), Node 4 (26686)",
      keyIsolation: "Independent priv_validator_key.json per node directory",
    },
  },
  {
    id: "storage",
    title: "Committed Blockchain & StateDB",
    subtitle: "IAVL Merkle trees + LevelDB block store",
    badge: "Storage Layer",
    accent: "#38bdf8",
    icon: CheckCircle2,
    overview:
      "Cryptographically authenticated persistent storage recording the immutable state root and transaction history.",
    whyExists:
      "Ensures cryptographic auditability, historic replayability, and tamper-proof verification of all state transitions.",
    internalWorkings: [
      "State root updated atomically following successful commit.",
      "Cosmos SDK commits multi-store IAVL tree (Immutable AVL+ tree) to LevelDB.",
      "Cosmos EVM persists world state trie (accounts, nonces, code hash, storage root).",
      "Block headers, transactions, and execution receipts stored in blockstore.db.",
    ],
    communicatesWith:
      "Cosmos App Multi-Store ↔ JSON-RPC query handlers",
    dataFlow:
      "Merkle proof generation, historical state queries, LevelDB batch writes.",
    specs: {
      dbEngine: "GoLevelDB / RocksDB",
      stateTree: "Cosmos IAVL+ Tree & Ethereum Patricia Merkle Trie",
      persistence: "Isolated data/node1/data through data/node4/data",
    },
  },
];

export default function SectionAOverview() {
  const [selectedNodeId, setSelectedNodeId] = useState("clients");

  const activeNode =
    ARCH_NODES.find((n) => n.id === selectedNodeId) || ARCH_NODES[0];
  const IconComponent = activeNode.icon;

  return (
    <section id="section-overview" className="arch-section">
      <div className="arch-section-header">
        <span className="arch-section-tag">
          <Zap size={14} /> Section A — High-Level System Architecture
        </span>
        <h2 className="arch-title">Inside Chain99</h2>
        <p className="arch-subtitle">
          Explore how transactions execute, validators reach consensus, and the
          blockchain achieves deterministic single-block finality.
        </p>
      </div>

      <div className="arch-diagram-grid">
        {/* Left Column: Interactive Diagram Flow */}
        <div className="nodes-flow-container">
          <div
            style={{
              fontSize: "0.82rem",
              color: "#94a3b8",
              marginBottom: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>
              Click any architecture node below to inspect its internal mechanics
              and data contracts:
            </span>
            <span style={{ color: "#06b6d4", fontWeight: 600 }}>
              7 Layer Pipeline
            </span>
          </div>

          {ARCH_NODES.map((node, index) => {
            const isSelected = node.id === selectedNodeId;
            const NodeIcon = node.icon;

            return (
              <div key={node.id}>
                <div
                  className={`arch-node-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedNodeId(node.id)}
                  style={{
                    borderColor: isSelected ? node.accent : undefined,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                    }}
                  >
                    <div
                      className="arch-node-icon"
                      style={{
                        backgroundColor: `${node.accent}1a`,
                        border: `1px solid ${node.accent}4d`,
                        color: node.accent,
                      }}
                    >
                      <NodeIcon size={22} />
                    </div>
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "1rem",
                            color: isSelected ? "#fff" : "#e2e8f0",
                          }}
                        >
                          {node.title}
                        </span>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "999px",
                            backgroundColor: `${node.accent}20`,
                            color: node.accent,
                            border: `1px solid ${node.accent}50`,
                          }}
                        >
                          {node.badge}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "#94a3b8",
                        }}
                      >
                        {node.subtitle}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: isSelected ? node.accent : "#64748b",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.74rem",
                        fontWeight: 600,
                      }}
                    >
                      {isSelected ? "Active View" : "Inspect"}
                    </span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                {/* Animated Vertical Connector */}
                {index < ARCH_NODES.length - 1 && (
                  <div className="arch-connector-v">
                    <div className="connector-line-v">
                      <div className="connector-pulse-v" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right Column: Live Inspector Panel */}
        <div className="inspector-panel">
          <div className="inspector-header">
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${activeNode.accent}20`,
                border: `1px solid ${activeNode.accent}50`,
                color: activeNode.accent,
              }}
            >
              <IconComponent size={20} />
            </div>
            <div>
              <div className="inspector-label">Component Deep Dive</div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1.1rem",
                  color: "#fff",
                }}
              >
                {activeNode.title}
              </div>
            </div>
          </div>

          <div>
            <div className="inspector-label">What This Component Is</div>
            <div className="inspector-field">{activeNode.overview}</div>
          </div>

          <div>
            <div className="inspector-label">Why It Exists</div>
            <div className="inspector-field">{activeNode.whyExists}</div>
          </div>

          <div>
            <div className="inspector-label">Internal Mechanics</div>
            <div
              className="inspector-field"
              style={{ padding: "10px 14px" }}
            >
              <ul
                style={{
                  paddingLeft: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  fontSize: "0.82rem",
                }}
              >
                {activeNode.internalWorkings.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="inspector-label">Communicates With</div>
            <div className="inspector-field" style={{ color: "#38bdf8" }}>
              {activeNode.communicatesWith}
            </div>
          </div>

          <div>
            <div className="inspector-label">Data Ingestion & Flow</div>
            <div
              className="inspector-field"
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.78rem",
                color: "#a5b4fc",
              }}
            >
              {activeNode.dataFlow}
            </div>
          </div>

          <div>
            <div className="inspector-label">Technical Parameters</div>
            <div
              className="inspector-field"
              style={{
                fontSize: "0.76rem",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                background: "rgba(0,0,0,0.4)",
              }}
            >
              {Object.entries(activeNode.specs).map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{
                      color: "#94a3b8",
                      textTransform: "capitalize",
                    }}
                  >
                    {k.replace(/([A-Z])/g, " $1")}:
                  </span>
                  <span
                    style={{
                      color: "#fff",
                      fontFamily: "var(--font-mono, monospace)",
                      fontWeight: 600,
                    }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

