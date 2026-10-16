"use client";

import { useState, useEffect, useRef } from "react";
import { CONFIG } from "./lib/config";
import {
  rpcCall,
  hexToDecimal,
  truncateHash,
  formatEther,
  toWeiHex,
  waitForReceipt,
} from "./lib/rpc";

export default function Home() {
  // Navigation
  const [activeTab, setActiveTab] = useState("explorer");

  // Blockchain State
  const [latestBlock, setLatestBlock] = useState(null);
  const [validatorBal, setValidatorBal] = useState("0.00");
  const [connectedAddress, setConnectedAddress] = useState(null);
  const [isNodeOnline, setIsNodeOnline] = useState(true);

  // Block Feed & Pagination
  const [blocks, setBlocks] = useState([]);
  const [isLiveFeed, setIsLiveFeed] = useState(true);
  const [currentTopBlock, setCurrentTopBlock] = useState(null);
  const [jumpBlockInput, setJumpBlockInput] = useState("");
  const pageSize = 10;

  // Selected Block Modal
  const [inspectedBlock, setInspectedBlock] = useState(null);
  const [modalTab, setModalTab] = useState("overview");
  const [modalTxs, setModalTxs] = useState([]);
  const [loadingModalTxs, setLoadingModalTxs] = useState(false);

  // Faucet Form
  const [faucetRecipient, setFaucetRecipient] = useState("");
  const [faucetAmount, setFaucetAmount] = useState("10");
  const [faucetStatus, setFaucetStatus] = useState(null);
  const [faucetLoading, setFaucetLoading] = useState(false);

  // Contract Studio Form
  const [activeContract, setActiveContract] = useState(null);
  const [contractValue, setContractValue] = useState("--");
  const [contractValUpdated, setContractValUpdated] = useState("Never fetched");
  const [newContractVal, setNewContractVal] = useState("99");
  const [contractSignerMode, setContractSignerMode] = useState("validator");
  const [deployLoading, setDeployLoading] = useState(false);
  const [setTxLoading, setSetTxLoading] = useState(false);

  // Transfer Form
  const [transferSenderMode, setTransferSenderMode] = useState("validator");
  const [transferDest, setTransferDest] = useState("");
  const [transferAmount, setTransferAmount] = useState("5.0");
  const [transferStatus, setTransferStatus] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [senderBalanceDisplay, setSenderBalanceDisplay] = useState("Loading...");

  // JSON-RPC Console
  const [rpcPayload, setRpcPayload] = useState(
    JSON.stringify(
      {
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      },
      null,
      2
    )
  );
  const [rpcResponse, setRpcResponse] = useState("Response will appear here...");
  const [rpcLoading, setRpcLoading] = useState(false);

  // Toast System
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // ── Auto-Sync Contract Address ──────────────────────────────
  useEffect(() => {
    const cached = localStorage.getItem("chain99_storage_address");
    if (cached) {
      setActiveContract(cached);
    } else {
      fetch("/latest_contract.json")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.address) {
            setActiveContract(data.address);
            localStorage.setItem("chain99_storage_address", data.address);
          }
        })
        .catch(() => {});
    }
  }, []);

  // ── Block Poller Loop ───────────────────────────────────────
  const latestBlockRef = useRef(null);
  const isLiveFeedRef = useRef(true);
  useEffect(() => {
    isLiveFeedRef.current = isLiveFeed;
  }, [isLiveFeed]);

  const fetchBlocks = async (topBlockNum, isLive) => {
    const top = topBlockNum;
    const bottom = Math.max(0, top - (pageSize - 1));
    const requests = [];
    for (let i = top; i >= bottom; i--) {
      const hex = "0x" + i.toString(16);
      requests.push(rpcCall("eth_getBlockByNumber", [hex, false]));
    }
    try {
      const fetched = await Promise.all(requests);
      setBlocks(fetched.filter(Boolean));
      setCurrentTopBlock(top);
    } catch (err) {
      console.error("Failed to fetch blocks:", err);
    }
  };

  const pollNetwork = async () => {
    try {
      const blockHex = await rpcCall("eth_blockNumber");
      const num = hexToDecimal(blockHex);
      setIsNodeOnline(true);

      if (latestBlockRef.current === null || num > latestBlockRef.current) {
        latestBlockRef.current = num;
        setLatestBlock(num);

        if (isLiveFeedRef.current) {
          fetchBlocks(num, true);
        }

        // Fetch validator balance
        try {
          const balHex = await rpcCall("eth_getBalance", [
            CONFIG.VALIDATOR_ADDRESS,
            "latest",
          ]);
          setValidatorBal(formatEther(balHex));
        } catch (e) {}

        // Auto-refresh contract value if active
        if (activeContract) {
          readContractValue(activeContract);
        }
      }
    } catch (err) {
      setIsNodeOnline(false);
    }
  };

  useEffect(() => {
    pollNetwork();
    const interval = setInterval(pollNetwork, 1800);
    return () => clearInterval(interval);
  }, [activeContract]);

  // Update sender balance on mode change
  useEffect(() => {
    const updateSenderBal = async () => {
      try {
        if (transferSenderMode === "injected") {
          if (connectedAddress) {
            const balHex = await rpcCall("eth_getBalance", [
              connectedAddress,
              "latest",
            ]);
            setSenderBalanceDisplay(`Balance: ${formatEther(balHex)} C99`);
          } else {
            setSenderBalanceDisplay("Please connect MetaMask");
          }
        } else {
          const balHex = await rpcCall("eth_getBalance", [
            CONFIG.VALIDATOR_ADDRESS,
            "latest",
          ]);
          setSenderBalanceDisplay(`Balance: ${formatEther(balHex)} C99`);
        }
      } catch (e) {
        setSenderBalanceDisplay("Balance: --");
      }
    };
    updateSenderBal();
  }, [transferSenderMode, connectedAddress, validatorBal]);

  // ── Pagination Actions ──────────────────────────────────────
  const handleOlderBlocks = () => {
    setIsLiveFeed(false);
    const newTop = Math.max(0, (currentTopBlock ?? latestBlock ?? 0) - pageSize);
    fetchBlocks(newTop, false);
  };

  const handleNewerBlocks = () => {
    const target = (currentTopBlock ?? 0) + pageSize;
    if (target >= (latestBlock ?? 0)) {
      handleReturnToLive();
    } else {
      setIsLiveFeed(false);
      fetchBlocks(target, false);
    }
  };

  const handleReturnToLive = () => {
    setIsLiveFeed(true);
    if (latestBlock !== null) {
      fetchBlocks(latestBlock, true);
    }
    showToast("Resumed real-time block feed.", "info");
  };

  const handleGenesisBlock = () => {
    setIsLiveFeed(false);
    const genTop = Math.min(latestBlock || 0, pageSize - 1);
    fetchBlocks(genTop, false);
    showToast("Jumped to Genesis Block #0.", "info");
  };

  const handleJumpBlock = () => {
    const target = parseInt(jumpBlockInput, 10);
    if (isNaN(target) || target < 0) {
      showToast("Please enter a valid block number (>= 0).", "error");
      return;
    }
    if (latestBlock !== null && target > latestBlock) {
      showToast(`Block #${target} has not been mined yet.`, "error");
      return;
    }
    setIsLiveFeed(target === latestBlock);
    const top = Math.min(latestBlock || target, target + 5);
    fetchBlocks(top, false);
    setJumpBlockInput("");
    showToast(`Navigated to Block #${target}.`, "success");
  };

  // ── Block Modal Inspector ───────────────────────────────────
  const openBlockInspector = async (block) => {
    setInspectedBlock(block);
    setModalTab("overview");
    setModalTxs([]);

    if (block.transactions && block.transactions.length > 0) {
      setLoadingModalTxs(true);
      try {
        const txList = await Promise.all(
          block.transactions.map(async (h) => {
            try {
              return await rpcCall("eth_getTransactionByHash", [h]);
            } catch (e) {
              return { hash: h };
            }
          })
        );
        setModalTxs(txList.filter(Boolean));
      } catch (err) {
        console.error("Failed to load txs for modal:", err);
      } finally {
        setLoadingModalTxs(false);
      }
    }
  };

  // ── Wallet Connection ───────────────────────────────────────
  const addChain99ToMetaMask = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      showToast("MetaMask not detected in your browser.", "error");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CONFIG.CHAIN_ID_HEX,
            chainName: CONFIG.CHAIN_NAME,
            nativeCurrency: {
              name: "Chain99",
              symbol: CONFIG.TOKEN_SYMBOL,
              decimals: CONFIG.TOKEN_DECIMALS,
            },
            rpcUrls: [CONFIG.RPC_URL],
          },
        ],
      });
      showToast("Chain99 added to MetaMask!", "success");
    } catch (err) {
      showToast(`Failed to add network: ${err.message}`, "error");
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      showToast("Please install MetaMask to connect.", "error");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts.length > 0) {
        setConnectedAddress(accounts[0]);
        setFaucetRecipient(accounts[0]);
        showToast(`Connected: ${truncateHash(accounts[0], 6, 4)}`, "success");
      }
    } catch (err) {
      showToast(`Connection failed: ${err.message}`, "error");
    }
  };

  // ── Faucet ──────────────────────────────────────────────────
  const requestFaucet = async () => {
    if (!faucetRecipient || !faucetRecipient.startsWith("0x") || faucetRecipient.length !== 42) {
      showToast("Enter a valid 42-character Ethereum address.", "error");
      return;
    }
    setFaucetLoading(true);
    setFaucetStatus({ title: "Submitting to node mempool...", hash: null, ok: null });

    try {
      const wei = toWeiHex(faucetAmount);
      const txHash = await rpcCall("eth_sendTransaction", [
        {
          from: CONFIG.VALIDATOR_ADDRESS,
          to: faucetRecipient,
          value: wei,
        },
      ]);
      setFaucetStatus({
        title: "Sealing into next 2-second block...",
        hash: txHash,
        ok: null,
      });
      await waitForReceipt(txHash);
      setFaucetStatus({
        title: `🎉 Successfully dispensed ${faucetAmount} C99!`,
        hash: txHash,
        ok: true,
      });
      showToast(`Dispensed ${faucetAmount} C99!`, "success");
    } catch (err) {
      setFaucetStatus({
        title: `❌ Faucet Failed: ${err.message}`,
        hash: null,
        ok: false,
      });
      showToast(`Faucet error: ${err.message}`, "error");
    } finally {
      setFaucetLoading(false);
    }
  };

  // ── Contract Studio ─────────────────────────────────────────
  const readContractValue = async (targetAddr) => {
    const addr = targetAddr || activeContract;
    if (!addr) return;
    try {
      const res = await rpcCall("eth_call", [
        { to: addr, data: "0x3fa4f245" }, // value() selector
        "latest",
      ]);
      const val = hexToDecimal(res);
      setContractValue(val.toString());
      setContractValUpdated(`Updated: ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.warn("Could not read contract value:", err);
    }
  };

  const deployNewContract = async () => {
    setDeployLoading(true);
    try {
      showToast("Deploying Storage.sol from validator...", "info");
      const txHash = await rpcCall("eth_sendTransaction", [
        {
          from: CONFIG.VALIDATOR_ADDRESS,
          data: CONFIG.STORAGE_BIN,
          gas: "0x47b760",
        },
      ]);
      const receipt = await waitForReceipt(txHash);
      if (receipt?.contractAddress) {
        setActiveContract(receipt.contractAddress);
        localStorage.setItem("chain99_storage_address", receipt.contractAddress);
        showToast(`Deployed at ${truncateHash(receipt.contractAddress)}!`, "success");
        await readContractValue(receipt.contractAddress);
      }
    } catch (err) {
      showToast(`Deploy failed: ${err.message}`, "error");
    } finally {
      setDeployLoading(false);
    }
  };

  const executeSetTransaction = async () => {
    if (!activeContract) {
      showToast("Please deploy or load a contract first!", "error");
      return;
    }
    setSetTxLoading(true);
    try {
      const val = parseInt(newContractVal, 10);
      const valHex = val.toString(16).padStart(64, "0");
      const data = "0x60fe47b1" + valHex; // set(uint256) selector

      let txHash;
      if (contractSignerMode === "injected") {
        if (!connectedAddress) {
          throw new Error("Connect your MetaMask wallet in the header first!");
        }
        txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: connectedAddress, to: activeContract, data }],
        });
      } else {
        txHash = await rpcCall("eth_sendTransaction", [
          { from: CONFIG.VALIDATOR_ADDRESS, to: activeContract, data },
        ]);
      }

      showToast(`Transaction sent! Waiting for 2s block seal...`, "info");
      await waitForReceipt(txHash);
      showToast(`Value updated to ${val} on-chain!`, "success");
      await readContractValue();
    } catch (err) {
      showToast(`Set failed: ${err.message}`, "error");
    } finally {
      setSetTxLoading(false);
    }
  };

  // ── Native Transfer ─────────────────────────────────────────
  const handleTransfer = async () => {
    if (!transferDest || !transferDest.startsWith("0x") || transferDest.length !== 42) {
      showToast("Provide a valid 42-character recipient address.", "error");
      return;
    }
    setTransferLoading(true);
    setTransferStatus({ title: "Submitting transfer...", hash: null, ok: null });

    try {
      const weiHex = toWeiHex(transferAmount);
      let txHash;

      if (transferSenderMode === "injected") {
        if (!connectedAddress) {
          throw new Error("Connect your MetaMask wallet in the header first!");
        }
        txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: connectedAddress, to: transferDest, value: weiHex }],
        });
      } else {
        txHash = await rpcCall("eth_sendTransaction", [
          { from: CONFIG.VALIDATOR_ADDRESS, to: transferDest, value: weiHex },
        ]);
      }

      setTransferStatus({ title: "Waiting for block confirmation...", hash: txHash, ok: null });
      await waitForReceipt(txHash);
      setTransferStatus({
        title: `✅ Successfully sent ${transferAmount} C99!`,
        hash: txHash,
        ok: true,
      });
      showToast(`Transfer of ${transferAmount} C99 confirmed!`, "success");
    } catch (err) {
      setTransferStatus({
        title: `❌ Transfer Failed: ${err.message}`,
        hash: null,
        ok: false,
      });
      showToast(`Transfer failed: ${err.message}`, "error");
    } finally {
      setTransferLoading(false);
    }
  };

  // ── JSON-RPC Execution ──────────────────────────────────────
  const executeRpcQuery = async () => {
    setRpcLoading(true);
    const start = performance.now();
    try {
      const parsed = JSON.parse(rpcPayload);
      const res = await rpcCall(parsed.method, parsed.params || []);
      const dur = (performance.now() - start).toFixed(2);
      setRpcResponse(`// Took ${dur}ms\n` + JSON.stringify(res, null, 2));
    } catch (err) {
      setRpcResponse(`// Error:\n` + err.message);
    } finally {
      setRpcLoading(false);
    }
  };

  // ── Render Helpers ──────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(((latestBlock ?? 0) + 1) / pageSize));
  const currentPage = Math.max(
    1,
    Math.floor(((latestBlock ?? 0) - (currentTopBlock ?? (latestBlock ?? 0))) / pageSize) + 1
  );
  const bottomBlock = Math.max(0, (currentTopBlock ?? (latestBlock ?? 0)) - (pageSize - 1));

  return (
    <div style={{ minHeight: "100vh", paddingBottom: "60px" }}>
      {/* ── Top Navigation Bar ───────────────────────────────── */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="logo-icon">⛓️</div>
          <div>
            <div className="brand-title">Chain99 L1</div>
            <div className="brand-subtitle">Sovereign EVM Devnet · Chain ID {CONFIG.CHAIN_ID}</div>
          </div>
        </div>

        <div className="nav-actions">
          <div
            id="net-status-badge"
            className="badge"
            style={{
              background: isNodeOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
              color: isNodeOnline ? "var(--accent-emerald)" : "var(--accent-rose)",
            }}
          >
            <span
              id="pulse-dot"
              className="pulse-dot"
              style={{
                background: isNodeOnline ? "var(--accent-emerald)" : "var(--accent-rose)",
              }}
            ></span>
            <span>{isNodeOnline ? "Online · 2s Blocks" : "Node Offline"}</span>
          </div>

          <button className="btn btn-metamask btn-sm" onClick={addChain99ToMetaMask}>
            <span>🦊</span>
            <span>Add to MetaMask</span>
          </button>

          <button
            className={`btn btn-sm ${connectedAddress ? "btn-primary" : "btn-secondary"}`}
            onClick={connectWallet}
          >
            {connectedAddress ? (
              <span>🟢 {truncateHash(connectedAddress, 6, 4)}</span>
            ) : (
              <span>Connect Wallet</span>
            )}
          </button>
        </div>
      </header>

      {/* ── KPI Grid ─────────────────────────────────────────── */}
      <main className="container">
        <section className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">
              <span>Latest Block</span>
              <span>⛓️</span>
            </div>
            <div className="kpi-value" style={{ color: "var(--accent-cyan)" }}>
              #{latestBlock !== null ? latestBlock.toLocaleString() : "--"}
            </div>
            <div className="kpi-sub">Clique Sealing (2.0s)</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Consensus</span>
              <span>🛡️</span>
            </div>
            <div className="kpi-value">Clique PoA</div>
            <div className="kpi-sub">EIP-225 Proof-of-Authority</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Native Token</span>
              <span>🪙</span>
            </div>
            <div className="kpi-value" style={{ color: "var(--accent-emerald)" }}>
              {CONFIG.TOKEN_SYMBOL}
            </div>
            <div className="kpi-sub">Pool: {validatorBal} C99</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Gas Base Fee</span>
              <span>⛽</span>
            </div>
            <div className="kpi-value">1.0 Gwei</div>
            <div className="kpi-sub">Target: 30,000,000 Gas</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Signer / Validator</span>
              <span>🔑</span>
            </div>
            <div className="kpi-value font-mono" style={{ fontSize: "1rem", color: "var(--accent-cyan)" }}>
              {truncateHash(CONFIG.VALIDATOR_ADDRESS, 8, 6)}
            </div>
            <div className="kpi-sub">Node 1 Mining Sealer</div>
          </div>
        </section>

        {/* ── Main Tab Navigation ─────────────────────────────── */}
        <nav className="tabs-header" role="tablist">
          <button
            className={`tab-btn ${activeTab === "explorer" ? "active" : ""}`}
            onClick={() => setActiveTab("explorer")}
          >
            <span>⛓️</span> Live Block Explorer
          </button>
          <button
            className={`tab-btn ${activeTab === "faucet" ? "active" : ""}`}
            onClick={() => setActiveTab("faucet")}
          >
            <span>💧</span> C99 Faucet (Dispenser)
          </button>
          <button
            className={`tab-btn ${activeTab === "studio" ? "active" : ""}`}
            onClick={() => setActiveTab("studio")}
          >
            <span>📜</span> Storage Contract Studio
          </button>
          <button
            className={`tab-btn ${activeTab === "transfer" ? "active" : ""}`}
            onClick={() => setActiveTab("transfer")}
          >
            <span>💸</span> Native C99 Transfer
          </button>
          <button
            className={`tab-btn ${activeTab === "rpc" ? "active" : ""}`}
            onClick={() => setActiveTab("rpc")}
          >
            <span>🔬</span> JSON-RPC Console
          </button>
          <button
            className={`tab-btn ${activeTab === "arch" ? "active" : ""}`}
            onClick={() => setActiveTab("arch")}
          >
            <span>🏗️</span> Architecture
          </button>
        </nav>

        {/* ── Tab 1: Live Block Explorer ──────────────────────── */}
        {activeTab === "explorer" && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <span>Real-Time Mined Blocks Feed</span>
                <span
                  className="block-badge"
                  style={{
                    background: isLiveFeed ? "" : "rgba(245, 158, 11, 0.2)",
                    color: isLiveFeed ? "" : "var(--accent-amber)",
                  }}
                >
                  {isLiveFeed ? `#${latestBlock} (Live)` : "History (Paused)"}
                </span>
                {!isLiveFeed && (
                  <button className="btn-sm-action" onClick={handleReturnToLive}>
                    ⚡ Return to Live
                  </button>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                Click any block row to inspect detailed header & trie hashes
              </div>
            </div>

            <div className="blocks-table-wrap">
              <table className="block-table">
                <thead>
                  <tr>
                    <th>Block #</th>
                    <th>Age</th>
                    <th>Transactions</th>
                    <th>Gas Used</th>
                    <th>Block Hash</th>
                    <th>Sealer (Miner)</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                        Listening for blocks from Chain99...
                      </td>
                    </tr>
                  ) : (
                    blocks.map((b) => {
                      const bNum = hexToDecimal(b.number);
                      const txCount = b.transactions ? b.transactions.length : 0;
                      const gasUsed = hexToDecimal(b.gasUsed);
                      const time = new Date(hexToDecimal(b.timestamp) * 1000).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      });
                      return (
                        <tr
                          key={b.hash}
                          className="block-row"
                          onClick={() => openBlockInspector(b)}
                        >
                          <td><span className="block-badge">#{bNum}</span></td>
                          <td style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{time}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: txCount > 0 ? "var(--accent-emerald)" : "var(--text-dim)" }}>
                              {txCount} txs
                            </span>
                          </td>
                          <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                            {gasUsed.toLocaleString()} gas
                          </td>
                          <td className="hash-cell" title={b.hash}>
                            {truncateHash(b.hash, 10, 8)}
                          </td>
                          <td className="font-mono" style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            {truncateHash(b.miner || CONFIG.VALIDATOR_ADDRESS, 8, 6)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="block-pagination-bar">
              <div className="pagination-info">
                Showing Blocks <strong style={{ color: "var(--text-main)" }}>#{currentTopBlock ?? latestBlock ?? 0}</strong> to{" "}
                <strong style={{ color: "var(--text-main)" }}>#{bottomBlock}</strong> (Latest Mined: #{latestBlock})
              </div>
              <div className="pagination-controls">
                <button
                  className="pag-btn"
                  onClick={handleReturnToLive}
                  disabled={isLiveFeed || currentTopBlock >= (latestBlock ?? 0)}
                >
                  ⏮️ Latest
                </button>
                <button
                  className="pag-btn"
                  onClick={handleNewerBlocks}
                  disabled={isLiveFeed || currentTopBlock >= (latestBlock ?? 0)}
                >
                  ◀️ Newer
                </button>
                <span className="pag-page-pill">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="pag-btn"
                  onClick={handleOlderBlocks}
                  disabled={bottomBlock <= 0}
                >
                  Older ▶️
                </button>
                <button
                  className="pag-btn"
                  onClick={handleGenesisBlock}
                  disabled={bottomBlock <= 0}
                >
                  Genesis ⏭️
                </button>
              </div>
              <div className="pagination-jump">
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Jump to Block:</span>
                <input
                  type="number"
                  className="pag-input"
                  placeholder="e.g. 1021"
                  min="0"
                  value={jumpBlockInput}
                  onChange={(e) => setJumpBlockInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJumpBlock()}
                />
                <button className="pag-btn-primary" onClick={handleJumpBlock}>
                  Go
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 2: C99 Faucet ───────────────────────────────── */}
        {activeTab === "faucet" && (
          <div className="panel" style={{ maxWidth: "780px", margin: "0 auto" }}>
            <div className="panel-header">
              <div className="panel-title">💧 Chain99 Native C99 Faucet</div>
              <span className="badge-chain">Zero Gas Cost</span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px" }}>
              Dispense native <strong>C99</strong> tokens directly from the pre-funded genesis pool to your connected wallet or any address.
            </p>
            <div className="form-group">
              <label className="form-label">Recipient Ethereum Address</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="0x..."
                value={faucetRecipient}
                onChange={(e) => setFaucetRecipient(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (C99)</label>
              <div style={{ display: "flex", gap: "10px" }}>
                {["1", "5", "10", "50"].map((amt) => (
                  <button
                    key={amt}
                    className={`btn btn-sm ${faucetAmount === amt ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setFaucetAmount(amt)}
                  >
                    {amt} C99
                  </button>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", marginTop: "10px" }}
              disabled={faucetLoading}
              onClick={requestFaucet}
            >
              {faucetLoading ? "Dispensing Tokens..." : `Request ${faucetAmount} C99 Tokens`}
            </button>
            {faucetStatus && (
              <div style={{ marginTop: "20px", padding: "16px", borderRadius: "10px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 600, color: faucetStatus.ok ? "var(--accent-emerald)" : faucetStatus.ok === false ? "var(--accent-rose)" : "var(--accent-cyan)" }}>
                  {faucetStatus.title}
                </div>
                {faucetStatus.hash && (
                  <div className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", marginTop: "4px" }}>
                    Tx Hash: {faucetStatus.hash}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Contract Studio ──────────────────────────── */}
        {activeTab === "studio" && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">📜 Storage.sol Contract Studio</div>
              <button
                className="btn btn-primary btn-sm"
                disabled={deployLoading}
                onClick={deployNewContract}
              >
                {deployLoading ? "Deploying..." : "🚀 Deploy New Storage Contract"}
              </button>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)", borderRadius: "10px", padding: "14px 18px", marginBottom: "24px" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>ACTIVE CONTRACT ADDRESS</div>
              <div className="font-mono" style={{ color: activeContract ? "var(--accent-emerald)" : "var(--text-muted)", fontWeight: activeContract ? 600 : "normal" }}>
                {activeContract || "Not deployed yet (Click 'Deploy New' above or run Hardhat)"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Read Value */}
              <div className="panel" style={{ background: "rgba(255,255,255,0.02)", marginBottom: 0 }}>
                <h4 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span>🔍</span> Read State: <code>value()</code>
                </h4>
                <div className="val-display-box" style={{ textAlign: "center", padding: "24px" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>CURRENT STORED VALUE</div>
                  <div className="val-big-number" style={{ fontSize: "2.8rem", fontWeight: 800, color: "var(--accent-cyan)" }}>
                    {contractValue}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "6px" }}>{contractValUpdated}</div>
                </div>
                <button className="btn btn-secondary" style={{ width: "100%", marginTop: "14px" }} onClick={() => readContractValue()}>
                  ↻ Refresh Value
                </button>
              </div>

              {/* Mutate Value */}
              <div className="panel" style={{ background: "rgba(255,255,255,0.02)", marginBottom: 0 }}>
                <h4 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span>✏️</span> Mutate State: <code>set(uint256)</code>
                </h4>
                <div className="form-group">
                  <label className="form-label">New Value (uint256)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newContractVal}
                    onChange={(e) => setNewContractVal(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Signing Identity</label>
                  <select
                    className="form-select"
                    value={contractSignerMode}
                    onChange={(e) => setContractSignerMode(e.target.value)}
                  >
                    <option value="validator">Genesis Validator (Node 1 Unlocked)</option>
                    <option value="injected">Connected Web3 Wallet (MetaMask)</option>
                  </select>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: "10px" }}
                  disabled={setTxLoading}
                  onClick={executeSetTransaction}
                >
                  {setTxLoading ? "Mining Transaction..." : "Execute set() Transaction"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 4: Native Transfer ──────────────────────────── */}
        {activeTab === "transfer" && (
          <div className="panel" style={{ maxWidth: "780px", margin: "0 auto" }}>
            <div className="panel-header">
              <div className="panel-title">💸 Transfer Native C99 Currency</div>
            </div>
            <div className="form-group">
              <label className="form-label">Sender Account</label>
              <select
                className="form-select"
                value={transferSenderMode}
                onChange={(e) => setTransferSenderMode(e.target.value)}
              >
                <option value="validator">Genesis Validator (Node 1 Pool: 0x86fc...A904)</option>
                <option value="injected">Connected Browser Wallet (MetaMask)</option>
              </select>
              <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                <span>{transferSenderMode === "injected" ? (connectedAddress ? `Sender: ${truncateHash(connectedAddress, 8, 6)}` : "MetaMask Not Connected") : `Sender: ${truncateHash(CONFIG.VALIDATOR_ADDRESS, 8, 6)}`}</span>
                <span style={{ color: "var(--accent-emerald)", fontWeight: 600 }}>{senderBalanceDisplay}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Destination Address</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="0x..."
                value={transferDest}
                onChange={(e) => setTransferDest(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Amount (C99)</label>
              <input
                type="number"
                className="form-input"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              style={{ width: "100%", padding: "12px", marginTop: "10px" }}
              disabled={transferLoading}
              onClick={handleTransfer}
            >
              {transferLoading ? "Broadcasting..." : "Broadcast Transfer"}
            </button>
            {transferStatus && (
              <div style={{ marginTop: "20px", padding: "16px", borderRadius: "10px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontWeight: 600, color: transferStatus.ok ? "var(--accent-emerald)" : transferStatus.ok === false ? "var(--accent-rose)" : "var(--accent-cyan)" }}>
                  {transferStatus.title}
                </div>
                {transferStatus.hash && (
                  <div className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", marginTop: "4px" }}>
                    Tx Hash: {transferStatus.hash}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 5: JSON-RPC Console ─────────────────────────── */}
        {activeTab === "rpc" && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">🔬 Low-Level JSON-RPC Terminal</div>
              <span className="badge-chain">Endpoint: http://127.0.0.1:8545</span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
              {[
                { label: "eth_blockNumber", method: "eth_blockNumber", params: [] },
                { label: "net_version (Chain ID)", method: "net_version", params: [] },
                { label: "eth_mining", method: "eth_mining", params: [] },
                { label: "eth_gasPrice", method: "eth_gasPrice", params: [] },
                { label: "txpool_status", method: "txpool_status", params: [] },
                { label: "net_peerCount", method: "net_peerCount", params: [] },
              ].map((p) => (
                <button
                  key={p.label}
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setRpcPayload(
                      JSON.stringify({ jsonrpc: "2.0", method: p.method, params: p.params, id: Date.now() }, null, 2)
                    )
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            <textarea
              className="form-input font-mono"
              rows={6}
              style={{ width: "100%", marginBottom: "14px" }}
              value={rpcPayload}
              onChange={(e) => setRpcPayload(e.target.value)}
            />
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
              <button className="btn btn-primary" disabled={rpcLoading} onClick={executeRpcQuery}>
                {rpcLoading ? "Querying..." : "Send Request"}
              </button>
              <button className="btn btn-secondary" onClick={() => setRpcResponse("Response will appear here...")}>
                Clear
              </button>
            </div>
            <pre className="code-output" style={{ maxHeight: "300px", overflowY: "auto" }}>
              {rpcResponse}
            </pre>
          </div>
        )}

        {/* ── Tab 6: Architecture ─────────────────────────────── */}
        {activeTab === "arch" && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">🏗️ Chain99 Architecture & Consensus</div>
            </div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "16px" }}>
              Chain99 is an independent Layer 1 blockchain prototype operating on <strong>Clique Proof-of-Authority (PoA)</strong> consensus with a guaranteed 2.0-second block time. Transactions are executed by the official Go-Ethereum (Geth) EVM engine.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                <h4 style={{ color: "var(--accent-cyan)", marginBottom: "8px" }}>⚙️ Core Parameters</h4>
                <ul style={{ color: "var(--text-muted)", fontSize: "0.85rem", paddingLeft: "18px", lineHeight: 1.8 }}>
                  <li><strong>Chain ID:</strong> 9999 (Sovereign Replay Protection)</li>
                  <li><strong>Native Token:</strong> C99 (18 decimals)</li>
                  <li><strong>Block Interval:</strong> 2.0 seconds</li>
                  <li><strong>Gas Limit:</strong> 30,000,000 gas per block</li>
                  <li><strong>Base Fee:</strong> London EIP-1559 enabled</li>
                </ul>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                <h4 style={{ color: "var(--accent-emerald)", marginBottom: "8px" }}>🚀 Developer Integration</h4>
                <ul style={{ color: "var(--text-muted)", fontSize: "0.85rem", paddingLeft: "18px", lineHeight: 1.8 }}>
                  <li><strong>RPC Endpoint:</strong> <code>http://127.0.0.1:8545</code></li>
                  <li><strong>Hardhat Network:</strong> <code>npx hardhat --network chain99</code></li>
                  <li><strong>MetaMask:</strong> 1-Click network injection</li>
                  <li><strong>Smart Contracts:</strong> 100% EVM bytecode compatible</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Block Inspector Modal ─────────────────────────────── */}
      {inspectedBlock && (
        <div className="modal-overlay open" onClick={(e) => e.target.classList.contains("modal-overlay") && setInspectedBlock(null)}>
          <div className="modal-dialog">
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ fontWeight: 700, fontSize: "1.25rem" }}>
                  Block #{hexToDecimal(inspectedBlock.number)}
                </div>
                <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "var(--accent-emerald)", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "0.75rem", padding: "3px 10px", borderRadius: "999px", fontWeight: 600 }}>
                  Finalized (Clique PoA)
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setInspectedBlock(null)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              {/* Stat Cards */}
              <div className="block-stat-grid">
                <div className="block-stat-card">
                  <div className="block-stat-label">Block Number</div>
                  <div className="block-stat-val">#{hexToDecimal(inspectedBlock.number)}</div>
                  <div className="block-stat-sub">Height</div>
                </div>
                <div className="block-stat-card">
                  <div className="block-stat-label">Transactions</div>
                  <div className="block-stat-val" style={{ color: inspectedBlock.transactions?.length > 0 ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                    {inspectedBlock.transactions?.length || 0} <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>txs</span>
                  </div>
                  <div className="block-stat-sub">{inspectedBlock.transactions?.length > 0 ? "Active payload" : "Consensus heartbeat"}</div>
                </div>
                <div className="block-stat-card">
                  <div className="block-stat-label">Gas Consumed</div>
                  <div className="block-stat-val">{hexToDecimal(inspectedBlock.gasUsed).toLocaleString()}</div>
                  <div className="block-stat-sub">
                    {((hexToDecimal(inspectedBlock.gasUsed) / hexToDecimal(inspectedBlock.gasLimit)) * 100).toFixed(2)}% limit
                  </div>
                </div>
                <div className="block-stat-card">
                  <div className="block-stat-label">Base Fee</div>
                  <div className="block-stat-val">{inspectedBlock.baseFeePerGas ? hexToDecimal(inspectedBlock.baseFeePerGas) : 7} wei</div>
                  <div className="block-stat-sub">{hexToDecimal(inspectedBlock.size)} bytes</div>
                </div>
              </div>

              {/* Modal Tabs */}
              <div className="modal-nav-tabs">
                <button className={`modal-nav-tab ${modalTab === "overview" ? "active" : ""}`} onClick={() => setModalTab("overview")}>
                  📊 Overview
                </button>
                <button className={`modal-nav-tab ${modalTab === "txs" ? "active" : ""}`} onClick={() => setModalTab("txs")}>
                  📦 Transactions ({inspectedBlock.transactions?.length || 0})
                </button>
                <button className={`modal-nav-tab ${modalTab === "raw" ? "active" : ""}`} onClick={() => setModalTab("raw")}>
                  💻 Raw JSON
                </button>
              </div>

              {/* Tab 1: Overview */}
              {modalTab === "overview" && (
                <div className="block-detail-table">
                  <div className="block-detail-row">
                    <div className="block-row-label">🕒 Timestamp</div>
                    <div className="block-row-value">
                      {new Date(hexToDecimal(inspectedBlock.timestamp) * 1000).toLocaleString()}
                    </div>
                  </div>
                  <div className="block-detail-row">
                    <div className="block-row-label">🔒 Block Hash</div>
                    <div className="block-row-value">
                      <span>{truncateHash(inspectedBlock.hash, 16, 12)}</span>
                      <button className="copy-pill-btn" onClick={() => navigator.clipboard.writeText(inspectedBlock.hash)}>📋 Copy</button>
                    </div>
                  </div>
                  <div className="block-detail-row">
                    <div className="block-row-label">🔗 Parent Hash</div>
                    <div className="block-row-value">
                      <span>{truncateHash(inspectedBlock.parentHash, 14, 10)}</span>
                      <button className="copy-pill-btn" onClick={() => navigator.clipboard.writeText(inspectedBlock.parentHash)}>📋 Copy</button>
                    </div>
                  </div>
                  <div className="block-detail-row">
                    <div className="block-row-label">⚡ Sealer (Miner)</div>
                    <div className="block-row-value">
                      <span style={{ color: "var(--accent-cyan)" }}>{truncateHash(CONFIG.VALIDATOR_ADDRESS, 12, 8)}</span>
                      <button className="copy-pill-btn" onClick={() => navigator.clipboard.writeText(CONFIG.VALIDATOR_ADDRESS)}>📋 Copy</button>
                    </div>
                  </div>
                  <div className="block-detail-row">
                    <div className="block-row-label">🌳 State Root</div>
                    <div className="block-row-value">{truncateHash(inspectedBlock.stateRoot, 14, 10)}</div>
                  </div>
                  <div className="block-detail-row">
                    <div className="block-row-label">⛽ Gas Usage</div>
                    <div className="block-row-value">
                      {hexToDecimal(inspectedBlock.gasUsed).toLocaleString()} / {hexToDecimal(inspectedBlock.gasLimit).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Transactions */}
              {modalTab === "txs" && (
                <div>
                  {loadingModalTxs ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                      ⏳ Loading transaction receipts...
                    </div>
                  ) : modalTxs.length === 0 ? (
                    <div className="empty-block-box">
                      <div className="empty-block-icon">⚡</div>
                      <div className="empty-block-title">Empty Consensus Heartbeat Block</div>
                      <div className="empty-block-desc">
                        No user transactions were submitted during this 2-second interval. The Chain99 validator signed this block to advance network state and synchronize consensus.
                      </div>
                    </div>
                  ) : (
                    modalTxs.map((tx, idx) => (
                      <div key={tx.hash} className="tx-card-item">
                        <div className="tx-header-line">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span className="badge" style={{ background: "rgba(99, 102, 241, 0.2)", color: "var(--accent-primary)", fontSize: "0.72rem", padding: "2px 8px", borderRadius: "4px" }}>
                              Tx #{idx + 1}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{truncateHash(tx.hash, 10, 8)}</span>
                            <button className="copy-pill-btn" onClick={() => navigator.clipboard.writeText(tx.hash)}>📋</button>
                          </div>
                          <div style={{ fontWeight: 700, color: "var(--accent-emerald)" }}>
                            {formatEther(tx.value || "0x0")} C99
                          </div>
                        </div>
                        <div className="tx-address-flow">
                          <span>From: <strong style={{ color: "var(--text-main)" }}>{truncateHash(tx.from, 8, 6)}</strong></span>
                          <span className="tx-arrow">➔</span>
                          <span>To: <strong style={{ color: tx.to ? "var(--text-main)" : "var(--accent-amber)" }}>{tx.to ? truncateHash(tx.to, 8, 6) : "[Contract Deployment 📄]"}</strong></span>
                          <span style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: "0.75rem" }}>
                            Gas: {tx.gas ? hexToDecimal(tx.gas).toLocaleString() : "N/A"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Raw JSON */}
              {modalTab === "raw" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
                    <button className="copy-pill-btn" onClick={() => navigator.clipboard.writeText(JSON.stringify(inspectedBlock, null, 2))}>
                      📋 Copy Full JSON
                    </button>
                  </div>
                  <pre className="code-output" style={{ maxHeight: "380px", overflowY: "auto" }}>
                    {JSON.stringify(inspectedBlock, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notifications ───────────────────────────────── */}
      <div id="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="toast toast-visible">
            <span>{t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
