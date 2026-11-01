"use client";

import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";
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

  // Proof of Stake / Validators State
  const [validators, setValidators] = useState([]);
  const [loadingValidators, setLoadingValidators] = useState(false);
  const [totalVotingPower, setTotalVotingPower] = useState(0);
  const [selectedValidator, setSelectedValidator] = useState("");
  const [stakeAction, setStakeAction] = useState("delegate"); // 'delegate' | 'undelegate'
  const [stakeAmount, setStakeAmount] = useState("100");
  const [stakeSignerMode, setStakeSignerMode] = useState("injected");
  const [stakeStatus, setStakeStatus] = useState(null);
  const [stakeLoading, setStakeLoading] = useState(false);

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

  // ── Validators Loader ───────────────────────────────────────
  const loadValidators = async () => {
    setLoadingValidators(true);
    try {
      const res = await fetch("/api/validators");
      const data = await res.json();
      if (data.validators) {
        setValidators(data.validators);
        setTotalVotingPower(data.totalVotingPower || 0);
        if (!selectedValidator && data.validators.length > 0) {
          setSelectedValidator(data.validators[0].operatorAddress);
        }
      }
    } catch (err) {
      console.warn("Could not load validators:", err);
    } finally {
      setLoadingValidators(false);
    }
  };

  useEffect(() => {
    loadValidators();
    const valInterval = setInterval(loadValidators, 6000);
    return () => clearInterval(valInterval);
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
    const interval = setInterval(pollNetwork, 1500);
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
    fetchBlocks(Math.min(latestBlock ?? 0, pageSize - 1), false);
    showToast("Loaded genesis block window.", "info");
  };

  const handleJumpBlock = (e) => {
    e.preventDefault();
    const target = parseInt(jumpBlockInput, 10);
    if (isNaN(target) || target < 0 || target > (latestBlock ?? 0)) {
      showToast(`Invalid block. Enter a number between 0 and ${latestBlock}.`, "error");
      return;
    }
    setIsLiveFeed(false);
    fetchBlocks(target, false);
    setJumpBlockInput("");
    showToast(`Jumped to block #${target}.`, "info");
  };

  // ── Block Inspector Modal ───────────────────────────────────
  const inspectBlock = async (block) => {
    setInspectedBlock(block);
    setModalTab("overview");
    setModalTxs([]);

    if (block.transactions && block.transactions.length > 0) {
      setLoadingModalTxs(true);
      try {
        const fullBlock = await rpcCall("eth_getBlockByNumber", [block.number, true]);
        const txList = await Promise.all(
          fullBlock.transactions.map(async (tx) => {
            try {
              const receipt = await rpcCall("eth_getTransactionReceipt", [tx.hash]);
              return { ...tx, receipt };
            } catch (e) {
              return tx;
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

  // ── Native PoS Staking via EVM Precompile (0x800) ───────────
  const executeStakingAction = async () => {
    if (!selectedValidator) {
      showToast("Please select a validator to stake with.", "error");
      return;
    }
    const valAmt = parseFloat(stakeAmount);
    if (isNaN(valAmt) || valAmt <= 0) {
      showToast("Please enter a valid amount of C99.", "error");
      return;
    }

    setStakeLoading(true);
    setStakeStatus({
      title: `Submitting ${stakeAction} to EVM Precompile 0x800...`,
      hash: null,
      ok: null,
    });

    try {
      const iface = new ethers.Interface(CONFIG.STAKING_ABI);
      const weiAmount = BigInt(Math.floor(valAmt * 1e18));

      let txHash;

      if (stakeSignerMode === "injected") {
        if (!connectedAddress) {
          throw new Error("Connect your MetaMask wallet in the header first!");
        }

        let calldata;
        if (stakeAction === "delegate") {
          calldata = iface.encodeFunctionData("delegate", [
            connectedAddress,
            selectedValidator,
            weiAmount,
          ]);
        } else {
          calldata = iface.encodeFunctionData("undelegate", [
            connectedAddress,
            selectedValidator,
            weiAmount,
          ]);
        }

        txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: connectedAddress,
              to: CONFIG.STAKING_PRECOMPILE_ADDRESS,
              data: calldata,
              gas: "0x61a80", // 400,000 gas
            },
          ],
        });
      } else {
        // Use Pre-funded genesis pool via /api/tx
        let calldata;
        if (stakeAction === "delegate") {
          calldata = iface.encodeFunctionData("delegate", [
            CONFIG.VALIDATOR_ADDRESS,
            selectedValidator,
            weiAmount,
          ]);
        } else {
          calldata = iface.encodeFunctionData("undelegate", [
            CONFIG.VALIDATOR_ADDRESS,
            selectedValidator,
            weiAmount,
          ]);
        }

        const res = await fetch("/api/tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: CONFIG.STAKING_PRECOMPILE_ADDRESS,
            data: calldata,
            gasLimit: 400000,
          }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        txHash = d.hash;
      }

      setStakeStatus({
        title: `Sealing ${stakeAction} into CometBFT consensus...`,
        hash: txHash,
        ok: null,
      });

      await waitForReceipt(txHash);

      setStakeStatus({
        title: `🎉 Successfully ${stakeAction}d ${stakeAmount} C99!`,
        hash: txHash,
        ok: true,
      });
      showToast(`${stakeAction} of ${stakeAmount} C99 confirmed!`, "success");
      await loadValidators();
    } catch (err) {
      setStakeStatus({
        title: `❌ Staking action failed: ${err.message}`,
        hash: null,
        ok: false,
      });
      showToast(`Staking failed: ${err.message}`, "error");
    } finally {
      setStakeLoading(false);
    }
  };

  // ── Faucet ──────────────────────────────────────────────────
  const requestFaucet = async () => {
    if (!faucetRecipient || !faucetRecipient.startsWith("0x") || faucetRecipient.length !== 42) {
      showToast("Enter a valid 42-character Ethereum address.", "error");
      return;
    }
    setFaucetLoading(true);
    setFaucetStatus({ title: "Submitting to dispenser...", hash: null, ok: null });

    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: faucetRecipient,
          amount: faucetAmount,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setFaucetStatus({
        title: `🎉 Successfully dispensed ${faucetAmount} C99!`,
        hash: data.hash,
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
      showToast("Deploying Storage.sol to CometBFT L1...", "info");
      let txHash, contractAddress;
      if (contractSignerMode === "injected") {
        if (!connectedAddress) throw new Error("Connect your MetaMask wallet in the header first!");
        txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{ from: connectedAddress, data: CONFIG.STORAGE_BIN, gas: "0x47b760" }],
        });
        const receipt = await waitForReceipt(txHash);
        contractAddress = receipt?.contractAddress;
      } else {
        const res = await fetch("/api/tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: CONFIG.STORAGE_BIN, gasLimit: 4700000 }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        txHash = d.hash;
        contractAddress = d.contractAddress;
      }

      if (contractAddress) {
        setActiveContract(contractAddress);
        localStorage.setItem("chain99_storage_address", contractAddress);
        showToast(`Deployed at ${truncateHash(contractAddress)}!`, "success");
        await readContractValue(contractAddress);
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
        await waitForReceipt(txHash);
      } else {
        const res = await fetch("/api/tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: activeContract, data }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        txHash = d.hash;
      }

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
        await waitForReceipt(txHash);
      } else {
        const res = await fetch("/api/tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: transferDest,
            value: BigInt(Math.floor(parseFloat(transferAmount) * 1e18)).toString(),
          }),
        });
        const d = await res.json();
        if (d.error) throw new Error(d.error);
        txHash = d.hash;
      }

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
            <div className="brand-subtitle">Cosmos SDK · CometBFT PoS · Chain ID {CONFIG.CHAIN_ID}</div>
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
            <span>{isNodeOnline ? "CometBFT Online · ~1.4s Finality" : "Nodes Offline"}</span>
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
            <div className="kpi-sub">CometBFT Consensus (~1.4s)</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Consensus Mechanism</span>
              <span>🛡️</span>
            </div>
            <div className="kpi-value" style={{ color: "var(--accent-emerald)" }}>
              CometBFT PoS
            </div>
            <div className="kpi-sub">Deterministic 1-Block Finality</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Active Validators</span>
              <span>👥</span>
            </div>
            <div className="kpi-value">
              {validators.length > 0 ? `${validators.length} / 4 Nodes` : "4 Nodes"}
            </div>
            <div className="kpi-sub">Total VP: {totalVotingPower.toLocaleString()} VP</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">
              <span>Gas Base Fee</span>
              <span>⛽</span>
            </div>
            <div className="kpi-value">1.0 Gwei</div>
            <div className="kpi-sub">EIP-1559 Dynamic EVM Fee</div>
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
            className={`tab-btn ${activeTab === "staking" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("staking");
              loadValidators();
            }}
          >
            <span>🥩</span> Proof of Stake
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
                <span>Real-Time CometBFT Committed Blocks Feed</span>
                <span className="badge-chain">Deterministic Finality</span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {!isLiveFeed && (
                  <button className="btn btn-secondary btn-sm" onClick={handleReturnToLive}>
                    ⚡ Resume Live Feed
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={handleGenesisBlock}>
                  ⏮️ Genesis
                </button>
              </div>
            </div>

            <div className="blocks-table-wrap">
              <table className="block-table">
                <thead>
                  <tr>
                    <th>Block Height</th>
                    <th>Committed Hash</th>
                    <th>Txs</th>
                    <th>Gas Used</th>
                    <th>Gas Limit</th>
                    <th>Base Fee</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((b) => (
                    <tr key={b.hash} onClick={() => inspectBlock(b)} style={{ cursor: "pointer" }}>
                      <td>
                        <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent-primary)" }}>
                          #{hexToDecimal(b.number)}
                        </span>
                      </td>
                      <td className="font-mono">{truncateHash(b.hash, 10, 8)}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: b.transactions?.length > 0 ? "var(--accent-emerald)" : "var(--text-muted)" }}>
                          {b.transactions?.length || 0}
                        </span>
                      </td>
                      <td>{hexToDecimal(b.gasUsed).toLocaleString()}</td>
                      <td>{hexToDecimal(b.gasLimit).toLocaleString()}</td>
                      <td>{b.baseFeePerGas ? hexToDecimal(b.baseFeePerGas) : 7} wei</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        {new Date(hexToDecimal(b.timestamp) * 1000).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-secondary btn-sm" onClick={handleOlderBlocks}>
                  ◀ Older Blocks
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleNewerBlocks} disabled={isLiveFeed}>
                  Newer Blocks ▶
                </button>
              </div>
              <form onSubmit={handleJumpBlock} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="number"
                  className="form-input"
                  style={{ width: "120px", padding: "4px 8px", fontSize: "0.85rem" }}
                  placeholder="Block #"
                  value={jumpBlockInput}
                  onChange={(e) => setJumpBlockInput(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm">
                  Jump
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Tab 2: Proof of Stake Dashboard & Staking Precompile ── */}
        {activeTab === "staking" && (
          <div>
            <div className="precompile-banner">
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚡ Native EVM Staking Precompile</span>
                  <span className="badge" style={{ background: "rgba(16, 185, 129, 0.2)", color: "var(--accent-emerald)" }}>
                    Active
                  </span>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                  Contract Address: <code style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>{CONFIG.STAKING_PRECOMPILE_ADDRESS}</code> — Directly updates Cosmos SDK <code>x/staking</code> & CometBFT consensus voting power.
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={loadValidators}>
                🔄 Refresh Validators
              </button>
            </div>

            <h3 style={{ marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>👥 Active CometBFT Consensus Validators</span>
              <span className="badge" style={{ background: "rgba(99, 102, 241, 0.15)", color: "var(--accent-primary)", fontSize: "0.8rem" }}>
                4 Independent Nodes
              </span>
            </h3>

            {/* Validator Cards */}
            <div className="val-grid">
              {validators.map((v) => (
                <div
                  key={v.operatorAddress}
                  className={`val-card ${selectedValidator === v.operatorAddress ? "selected" : ""}`}
                  onClick={() => setSelectedValidator(v.operatorAddress)}
                >
                  <div className="val-card-header">
                    <div className="val-moniker">
                      <span>🛡️</span> {v.moniker}
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: v.jailed ? "rgba(244, 63, 94, 0.15)" : "rgba(16, 185, 129, 0.15)",
                        color: v.jailed ? "var(--accent-rose)" : "var(--accent-emerald)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {v.jailed ? "JAILED" : "ACTIVE"}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.78rem", color: "var(--text-dim)", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>
                    {truncateHash(v.operatorAddress, 14, 8)}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Voting Power</span>
                    <strong style={{ color: "var(--accent-cyan)" }}>
                      {v.votingPower.toLocaleString()} VP ({v.votingPowerPercent}%)
                    </strong>
                  </div>

                  <div className="val-power-bar-wrap">
                    <div
                      className="val-power-bar-fill"
                      style={{ width: `${Math.min(100, Math.max(5, parseFloat(v.votingPowerPercent)))}%` }}
                    ></div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginTop: "10px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Bonded Stake:</span>
                    <span style={{ fontWeight: 600 }}>{parseInt(v.bondedTokensC99).toLocaleString()} C99</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginTop: "4px" }}>
                    <span style={{ color: "var(--text-muted)" }}>Commission:</span>
                    <span style={{ color: "var(--accent-amber)" }}>{v.commissionRate}%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Staking Console */}
            <div className="panel" style={{ maxWidth: "780px", margin: "0 auto" }}>
              <div className="panel-header">
                <div className="panel-title">
                  <span>⚡ Stake & Delegate C99 via EVM Precompile</span>
                </div>
                <span className="badge-chain">Precompile 0x800</span>
              </div>

              <div className="form-group">
                <label className="form-label">Signing Account</label>
                <select
                  className="form-select"
                  value={stakeSignerMode}
                  onChange={(e) => setStakeSignerMode(e.target.value)}
                >
                  <option value="injected">Connected MetaMask ({connectedAddress ? truncateHash(connectedAddress, 8, 6) : "Not Connected"})</option>
                  <option value="validator">Pre-funded Genesis Account ({truncateHash(CONFIG.VALIDATOR_ADDRESS, 8, 6)})</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Staking Operation</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      className={`btn btn-sm ${stakeAction === "delegate" ? "btn-primary" : "btn-secondary"}`}
                      style={{ flex: 1 }}
                      onClick={() => setStakeAction("delegate")}
                    >
                      Delegate C99
                    </button>
                    <button
                      className={`btn btn-sm ${stakeAction === "undelegate" ? "btn-primary" : "btn-secondary"}`}
                      style={{ flex: 1 }}
                      onClick={() => setStakeAction("undelegate")}
                    >
                      Undelegate C99
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Validator</label>
                  <select
                    className="form-select"
                    value={selectedValidator}
                    onChange={(e) => setSelectedValidator(e.target.value)}
                  >
                    {validators.map((v) => (
                      <option key={v.operatorAddress} value={v.operatorAddress}>
                        {v.moniker} ({v.votingPower} VP)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Stake Amount (C99)</label>
                <input
                  type="number"
                  className="form-input"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                />
                <div className="quick-amount-buttons">
                  {["100", "500", "1000", "5000"].map((amt) => (
                    <button
                      key={amt}
                      className="btn btn-secondary btn-sm"
                      onClick={() => setStakeAmount(amt)}
                    >
                      +{amt} C99
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: "100%", padding: "12px", marginTop: "12px" }}
                disabled={stakeLoading}
                onClick={executeStakingAction}
              >
                {stakeLoading ? "Processing via Precompile..." : `${stakeAction === "delegate" ? "Delegate" : "Undelegate"} ${stakeAmount} C99 to Validator`}
              </button>

              {stakeStatus && (
                <div style={{ marginTop: "20px", padding: "16px", borderRadius: "10px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontWeight: 600, color: stakeStatus.ok ? "var(--accent-emerald)" : stakeStatus.ok === false ? "var(--accent-rose)" : "var(--accent-cyan)" }}>
                    {stakeStatus.title}
                  </div>
                  {stakeStatus.hash && (
                    <div className="font-mono" style={{ fontSize: "0.8rem", color: "var(--accent-cyan)", marginTop: "4px" }}>
                      Tx Hash: {stakeStatus.hash}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 3: C99 Faucet ───────────────────────────────── */}
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

        {/* ── Tab 4: Contract Studio ──────────────────────────── */}
        {activeTab === "studio" && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">📜 Storage.sol Contract Studio</div>
              <button
                className="btn btn-primary btn-sm"
                disabled={deployLoading}
                onClick={deployNewContract}
              >
                {deployLoading ? "Deploying..." : "Deploy Fresh Instance"}
              </button>
            </div>

            <div className="contract-status-card">
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Active Instance Address</div>
                <div className="contract-address-display">
                  {activeContract ? activeContract : "No contract loaded (Deploy one!)"}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => readContractValue()}
                disabled={!activeContract}
              >
                🔄 Read value()
              </button>
            </div>

            <div className="contract-grid">
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                <h4 style={{ marginBottom: "12px" }}>📖 Read Contract</h4>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "8px" }}>
                  Current On-Chain Value:
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--accent-cyan)", marginBottom: "6px" }}>
                  {contractValue}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                  {contractValUpdated}
                </div>
              </div>

              <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                <h4 style={{ marginBottom: "12px" }}>✍️ Write Contract: set(uint256)</h4>
                <div className="form-group">
                  <label className="form-label">Signer Mode</label>
                  <select
                    className="form-select"
                    value={contractSignerMode}
                    onChange={(e) => setContractSignerMode(e.target.value)}
                  >
                    <option value="validator">Pre-funded Genesis Account</option>
                    <option value="injected">Connected MetaMask</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">New Value</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newContractVal}
                    onChange={(e) => setNewContractVal(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "10px" }}
                  disabled={setTxLoading || !activeContract}
                  onClick={executeSetTransaction}
                >
                  {setTxLoading ? "Updating on-chain..." : "Submit set(val)"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Native Transfer ──────────────────────────── */}
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
                <option value="validator">Pre-funded Genesis Pool (0x86fc...A904)</option>
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

        {/* ── Tab 6: JSON-RPC Console ─────────────────────────── */}
        {activeTab === "rpc" && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">🔬 Low-Level JSON-RPC Terminal</div>
              <button
                className="btn btn-primary btn-sm"
                disabled={rpcLoading}
                onClick={executeRpcQuery}
              >
                {rpcLoading ? "Querying..." : "Send RPC Call"}
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div>
                <label className="form-label">Request Payload (JSON)</label>
                <textarea
                  className="form-input font-mono"
                  style={{ height: "240px", resize: "vertical" }}
                  value={rpcPayload}
                  onChange={(e) => setRpcPayload(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Response</label>
                <pre
                  className="code-output font-mono"
                  style={{ height: "240px", overflowY: "auto", background: "rgba(0,0,0,0.4)" }}
                >
                  {rpcResponse}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 7: Architecture ─────────────────────────────── */}
        {activeTab === "arch" && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">🏗️ Chain99 Layer 1 Architecture & Consensus</div>
              <span className="badge-chain">Production PoS</span>
            </div>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7, marginBottom: "16px" }}>
              Chain99 is a production-grade Layer 1 blockchain engineered with <strong>Cosmos SDK v0.50</strong>, <strong>CometBFT v0.38</strong> consensus, and <strong>Cosmos EVM v20</strong>. Staking state is authoritatively held in <code>x/staking</code>, feeding dynamic validator set updates directly to CometBFT consensus engine for deterministic single-block finality.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                <h4 style={{ color: "var(--accent-cyan)", marginBottom: "8px" }}>⚙️ Core Protocol Specs</h4>
                <ul style={{ color: "var(--text-muted)", fontSize: "0.85rem", paddingLeft: "18px", lineHeight: 1.8 }}>
                  <li><strong>Consensus Engine:</strong> CometBFT v0.38.12 BFT PoS</li>
                  <li><strong>EVM Chain ID:</strong> 9999 (Cosmos: <code>chain_9999-1</code>)</li>
                  <li><strong>Native Denomination:</strong> C99 (18 decimals, base <code>ac99</code>)</li>
                  <li><strong>Active Validators:</strong> 4 independent nodes (P2P Mesh)</li>
                  <li><strong>BFT Finality:</strong> Single-block deterministic commit</li>
                  <li><strong>Unbonding Period:</strong> 14 days time-lock queue</li>
                </ul>
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                <h4 style={{ color: "var(--accent-emerald)", marginBottom: "8px" }}>🚀 Developer & EVM Integration</h4>
                <ul style={{ color: "var(--text-muted)", fontSize: "0.85rem", paddingLeft: "18px", lineHeight: 1.8 }}>
                  <li><strong>EVM JSON-RPC:</strong> <code>http://127.0.0.1:8545</code></li>
                  <li><strong>Staking Precompile:</strong> <code>{CONFIG.STAKING_PRECOMPILE_ADDRESS}</code></li>
                  <li><strong>EIP-1559 Support:</strong> Base fee burning + Priority tips</li>
                  <li><strong>MetaMask Compatible:</strong> 1-Click network injection</li>
                  <li><strong>Smart Contracts:</strong> 100% Solidity & Bytecode compatible</li>
                </ul>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", padding: "16px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
              <h4 style={{ color: "var(--accent-primary)", marginBottom: "8px" }}>🛡️ Consensus Safety & Quorum (3f + 1)</h4>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.7 }}>
                Under CometBFT BFT consensus, a block proposal requires <code>&gt; 2/3</code> of total bonded voting power to prevote and precommit. With 4 independent validators, the network tolerates 1 faulty or offline validator (<code>f = 1</code>) without halting or compromising safety. Slashing module automatically tracks missed blocks and double-signing equivocation evidence.
              </p>
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
                  Finalized (CometBFT PoS ⚡)
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
                    {((hexToDecimal(inspectedBlock.gasUsed) / (hexToDecimal(inspectedBlock.gasLimit) || 1)) * 100).toFixed(2)}% limit
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
                    </div>
                  </div>
                  <div className="block-detail-row">
                    <div className="block-row-label">🧱 Parent Hash</div>
                    <div className="block-row-value font-mono">
                      {truncateHash(inspectedBlock.parentHash, 16, 12)}
                    </div>
                  </div>
                  <div className="block-detail-row">
                    <div className="block-row-label">⛽ Gas Limit</div>
                    <div className="block-row-value font-mono">
                      {hexToDecimal(inspectedBlock.gasLimit).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Transactions */}
              {modalTab === "txs" && (
                <div>
                  {loadingModalTxs ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                      Fetching transaction receipts...
                    </div>
                  ) : modalTxs.length === 0 ? (
                    <div className="empty-block-box">
                      <div className="empty-block-icon">📦</div>
                      <div className="empty-block-title">No User Transactions</div>
                      <div className="empty-block-desc">
                        This block served as a consensus heartbeat maintaining CometBFT round-robin proposal agreements.
                      </div>
                    </div>
                  ) : (
                    modalTxs.map((tx, idx) => (
                      <div key={tx.hash} className="tx-card" style={{ padding: "12px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
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
