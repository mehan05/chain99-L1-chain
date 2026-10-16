// =============================================================
// Chain99 — Frontend Application Logic
// =============================================================

const CONFIG = {
  RPC_URL: "http://127.0.0.1:8545",
  FALLBACK_PROXY: "/api/rpc",
  CHAIN_ID: 9999,
  CHAIN_ID_HEX: "0x270f",
  CHAIN_NAME: "Chain99 L1 Devnet",
  TOKEN_SYMBOL: "C99",
  TOKEN_DECIMALS: 18,
  VALIDATOR_ADDRESS: "0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904",
  STORAGE_ABI: [
    {
      inputs: [{ internalType: "uint256", name: "_value", type: "uint256" }],
      name: "set",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [],
      name: "value",
      outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function"
    }
  ],
  STORAGE_BIN: "0x608060405234801561001057600080fd5b50610133806100206000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80633fa4f24514603757806360fe47b1146051575b600080fd5b603d6069565b604051604891906090565b60405180910390f35b606760048036038101906063919060d5565b606f565b005b60005481565b8060008190555050565b6000819050919050565b608a816079565b82525050565b600060208201905060a360008301846083565b92915050565b600080fd5b60b5816079565b811460bf57600080fd5b50565b60008135905060cf8160ae565b92915050565b60006020828403121560e85760e760a9565b5b600060f48482850160c2565b9150509291505056fea2646970667358221220163ae8ac938be83a59ceee131564df56c446709d7c56817a823b60fa9c87e89964736f6c63430008130033"
};

// Application State
let appState = {
  latestBlock: null,
  blocksCache: [],
  connectedAddress: null,
  activeContractAddress: localStorage.getItem("chain99_storage_address") || null,
  useProxy: false
};

// ── JSON-RPC Engine ──────────────────────────────────────────
async function rpcCall(method, params = []) {
  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params
  };

  const targetUrl = appState.useProxy ? CONFIG.FALLBACK_PROXY : CONFIG.RPC_URL;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    return data.result;
  } catch (err) {
    // If direct connection fails, try fallback proxy automatically
    if (!appState.useProxy) {
      console.warn("Direct RPC failed, switching to local proxy /api/rpc...", err);
      appState.useProxy = true;
      return rpcCall(method, params);
    }
    throw err;
  }
}

// ── Toast Notification Helper ────────────────────────────────
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";

  toast.innerHTML = `<span>${icon}</span><span style="flex: 1;">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// ── Utilities ────────────────────────────────────────────────
function truncateHash(hash, front = 8, back = 6) {
  if (!hash) return "";
  if (hash.length <= front + back) return hash;
  return `${hash.slice(0, front)}...${hash.slice(-back)}`;
}

function hexToDecimal(hex) {
  if (!hex) return 0;
  return parseInt(hex, 16);
}

function formatEther(weiHex) {
  try {
    if (window.ethers) {
      return Number(window.ethers.formatEther(weiHex)).toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
    const val = BigInt(weiHex);
    return (Number(val) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch (e) {
    return "0.00";
  }
}

function toWeiHex(c99Amount) {
  if (window.ethers) {
    return "0x" + window.ethers.parseEther(c99Amount.toString()).toString(16);
  }
  const wei = BigInt(Math.floor(parseFloat(c99Amount) * 1e18));
  return "0x" + wei.toString(16);
}

// ── Tab Navigation Controller ────────────────────────────────
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      const targetId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

// ── Live Block Poller & KPI Tracker ──────────────────────────
async function updateNetworkStatus() {
  try {
    const blockNumHex = await rpcCall("eth_blockNumber");
    const blockNum = hexToDecimal(blockNumHex);

    // Update connection badge
    const statusBadge = document.getElementById("net-status-badge");
    const statusText = document.getElementById("status-text");
    const pulseDot = document.getElementById("pulse-dot");
    statusBadge.style.color = "var(--accent-emerald)";
    pulseDot.style.background = "var(--accent-emerald)";
    statusText.innerText = `Online &bull; 2s Blocks`;

    // Update current block KPI
    document.getElementById("kpi-block-number").innerText = `#${blockNum.toLocaleString()}`;

    // If new block detected, fetch it
    if (appState.latestBlock === null || blockNum > appState.latestBlock) {
      appState.latestBlock = blockNum;
      await fetchAndRenderRecentBlocks(blockNum);
      updateValidatorBalance();
      if (appState.activeContractAddress) {
        refreshContractValue();
      }
    }
  } catch (err) {
    const statusText = document.getElementById("status-text");
    const pulseDot = document.getElementById("pulse-dot");
    statusText.innerText = `Node Offline (Run ./scripts/start-node.sh)`;
    pulseDot.style.background = "var(--accent-rose)";
    pulseDot.style.boxShadow = "0 0 10px var(--accent-rose)";
  }
}

async function updateValidatorBalance() {
  try {
    const balHex = await rpcCall("eth_getBalance", [CONFIG.VALIDATOR_ADDRESS, "latest"]);
    const bal = formatEther(balHex);
    document.getElementById("kpi-validator-balance").innerText = `Validator Pool: ${bal} C99`;
  } catch (e) {
    console.error("Failed to fetch validator balance:", e);
  }
}

async function fetchAndRenderRecentBlocks(currentBlockNum) {
  const blocksToFetch = [];
  const start = Math.max(0, currentBlockNum - 8);
  for (let i = currentBlockNum; i >= start; i--) {
    const hexI = "0x" + i.toString(16);
    blocksToFetch.push(rpcCall("eth_getBlockByNumber", [hexI, false]));
  }

  try {
    const blocks = await Promise.all(blocksToFetch);
    appState.blocksCache = blocks;

    const tbody = document.getElementById("blocks-table-body");
    tbody.innerHTML = "";

    blocks.forEach((block, idx) => {
      if (!block) return;
      const bNum = hexToDecimal(block.number);
      const txCount = block.transactions ? block.transactions.length : 0;
      const gasUsed = hexToDecimal(block.gasUsed);
      const miner = block.miner || CONFIG.VALIDATOR_ADDRESS;
      const timestamp = hexToDecimal(block.timestamp);
      const timeStr = new Date(timestamp * 1000).toLocaleTimeString();

      const tr = document.createElement("tr");
      tr.className = "block-row";
      tr.innerHTML = `
        <td><span class="block-badge">#${bNum}</span></td>
        <td style="color: var(--text-dim); font-size: 0.8rem;">${timeStr}</td>
        <td>
          <span style="font-weight: 600; color: ${txCount > 0 ? 'var(--accent-emerald)' : 'var(--text-dim)'};">
            ${txCount} txs
          </span>
        </td>
        <td style="color: var(--text-muted); font-size: 0.82rem;">${gasUsed.toLocaleString()} gas</td>
        <td class="hash-cell" title="${block.hash}">${truncateHash(block.hash, 10, 8)}</td>
        <td class="font-mono" style="font-size: 0.8rem; color: var(--text-muted);">${truncateHash(miner, 8, 6)}</td>
      `;

      tr.addEventListener("click", () => {
        openBlockModal(block);
      });

      tbody.appendChild(tr);
    });

    document.getElementById("block-feed-counter").innerText = `#${currentBlockNum}`;
  } catch (err) {
    console.error("Error fetching blocks:", err);
  }
}

// ── Block Inspector Modal ─────────────────────────────────────
function openBlockModal(block) {
  const modal = document.getElementById("block-modal");
  const title = document.getElementById("modal-block-title");
  const content = document.getElementById("modal-block-content");

  title.innerText = `Block #${hexToDecimal(block.number)} Inspection`;
  content.innerText = JSON.stringify(block, null, 2);
  modal.classList.add("open");
}

document.getElementById("btn-close-modal").addEventListener("click", () => {
  document.getElementById("block-modal").classList.remove("open");
});
document.getElementById("block-modal").addEventListener("click", (e) => {
  if (e.target.id === "block-modal") {
    document.getElementById("block-modal").classList.remove("open");
  }
});

// ── MetaMask Integration ──────────────────────────────────────
async function addChain99ToMetaMask() {
  if (!window.ethereum) {
    showToast("MetaMask or Web3 wallet not detected in your browser.", "error");
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
            decimals: CONFIG.TOKEN_DECIMALS
          },
          rpcUrls: [CONFIG.RPC_URL]
        }
      ]
    });
    showToast("Chain99 successfully added to MetaMask!", "success");
  } catch (err) {
    showToast(`Failed to add network: ${err.message}`, "error");
  }
}

async function connectBrowserWallet() {
  if (!window.ethereum) {
    showToast("Please install MetaMask to connect your wallet.", "error");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (accounts.length > 0) {
      appState.connectedAddress = accounts[0];
      const btn = document.getElementById("btn-connect-wallet");
      btn.innerHTML = `<span>🟢 ${truncateHash(accounts[0], 6, 4)}</span>`;
      btn.classList.remove("btn-secondary");
      btn.classList.add("btn-primary");
      showToast(`Connected: ${truncateHash(accounts[0], 6, 4)}`, "success");

      // Auto-fill faucet recipient if empty
      const faucetInput = document.getElementById("faucet-recipient");
      if (!faucetInput.value) {
        faucetInput.value = accounts[0];
      }
    }
  } catch (err) {
    showToast(`Connection failed: ${err.message}`, "error");
  }
}

// ── Faucet Module ─────────────────────────────────────────────
async function handleFaucetRequest() {
  const recipient = document.getElementById("faucet-recipient").value.trim();
  const amountStr = document.getElementById("faucet-amount").value;
  const statusBox = document.getElementById("faucet-status-box");
  const statusTitle = document.getElementById("faucet-status-title");
  const statusHash = document.getElementById("faucet-tx-hash");

  if (!recipient || !recipient.startsWith("0x") || recipient.length !== 42) {
    showToast("Please enter a valid 42-character Ethereum address (0x...).", "error");
    return;
  }

  const btn = document.getElementById("btn-send-faucet");
  btn.disabled = true;
  btn.innerText = "Broadcasting to Node 1...";

  statusBox.style.display = "block";
  statusTitle.innerText = "⏳ Submitting transaction to mempool...";
  statusHash.innerText = "From: " + truncateHash(CONFIG.VALIDATOR_ADDRESS);

  try {
    const weiHex = toWeiHex(amountStr);
    const txHash = await rpcCall("eth_sendTransaction", [
      {
        from: CONFIG.VALIDATOR_ADDRESS,
        to: recipient,
        value: weiHex
      }
    ]);

    statusTitle.innerText = `⏳ Mining into next 2s block...`;
    statusHash.innerText = `Tx Hash: ${txHash}`;
    showToast(`Faucet broadcasted! Awaiting block seal...`, "info");

    // Poll for receipt
    await waitForReceipt(txHash);

    statusTitle.innerText = `🎉 Successfully dispensed ${amountStr} C99!`;
    statusTitle.style.color = "var(--accent-emerald)";
    showToast(`Dispensed ${amountStr} C99 to ${truncateHash(recipient)}!`, "success");
    updateValidatorBalance();
  } catch (err) {
    statusTitle.innerText = "❌ Transaction Failed";
    statusTitle.style.color = "var(--accent-rose)";
    statusHash.innerText = err.message;
    showToast(`Faucet error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Request C99 Tokens";
  }
}

// ── Transaction Receipt Poller Helper ─────────────────────────
async function waitForReceipt(txHash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const receipt = await rpcCall("eth_getTransactionReceipt", [txHash]);
      if (receipt && receipt.blockNumber) {
        return receipt;
      }
    } catch (e) {
      // Keep waiting
    }
  }
  throw new Error("Transaction confirmation timed out after 30 seconds.");
}

// ── Smart Contract Studio ─────────────────────────────────────
async function deployStorageContract() {
  const btn = document.getElementById("btn-deploy-contract");
  btn.disabled = true;
  btn.innerText = "⏳ Deploying Bytecode...";

  try {
    showToast("Broadcasting contract deployment to Chain99...", "info");

    // Deploy using unlocked validator
    const txHash = await rpcCall("eth_sendTransaction", [
      {
        from: CONFIG.VALIDATOR_ADDRESS,
        data: CONFIG.STORAGE_BIN,
        gas: "0x47b760" // 4,700,000 gas limit
      }
    ]);

    showToast(`Deployment broadcasted (${truncateHash(txHash)})! Sealing block...`, "info");
    const receipt = await waitForReceipt(txHash);

    if (receipt.contractAddress) {
      appState.activeContractAddress = receipt.contractAddress;
      localStorage.setItem("chain99_storage_address", receipt.contractAddress);
      updateContractUI();
      showToast(`Contract deployed at ${truncateHash(receipt.contractAddress)}!`, "success");
      await refreshContractValue();
    } else {
      throw new Error("Receipt did not contain contract address.");
    }
  } catch (err) {
    showToast(`Deploy failed: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "🚀 Deploy New Storage Contract";
  }
}

function updateContractUI() {
  const addrElem = document.getElementById("active-contract-addr");
  if (appState.activeContractAddress) {
    addrElem.innerText = appState.activeContractAddress;
    addrElem.style.color = "var(--accent-emerald)";
  } else {
    addrElem.innerText = "Not deployed yet (Click 'Deploy New' above)";
    addrElem.style.color = "var(--text-muted)";
  }
}

async function refreshContractValue() {
  if (!appState.activeContractAddress) return;

  try {
    // value() selector is 0x3fa4f245
    const resultHex = await rpcCall("eth_call", [
      {
        to: appState.activeContractAddress,
        data: "0x3fa4f245"
      },
      "latest"
    ]);

    const num = hexToDecimal(resultHex);
    document.getElementById("contract-current-val").innerText = num.toString();
    document.getElementById("contract-val-updated").innerText = `Last updated: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error("Failed to read value():", err);
  }
}

async function executeSetContract() {
  if (!appState.activeContractAddress) {
    showToast("Please deploy the Storage contract first!", "error");
    return;
  }

  const newValInput = document.getElementById("input-new-val").value;
  const signerType = document.getElementById("select-contract-signer").value;
  const btn = document.getElementById("btn-execute-set");

  btn.disabled = true;
  btn.innerText = "⏳ Sealing Transaction...";

  try {
    const valBigInt = BigInt(newValInput);
    // set(uint256) selector: 0x60fe47b1
    const encodedArg = valBigInt.toString(16).padStart(64, "0");
    const callData = "0x60fe47b1" + encodedArg;

    let txHash;
    if (signerType === "injected" && window.ethereum && appState.connectedAddress) {
      txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: appState.connectedAddress,
            to: appState.activeContractAddress,
            data: callData
          }
        ]
      });
    } else {
      // Use unlocked validator
      txHash = await rpcCall("eth_sendTransaction", [
        {
          from: CONFIG.VALIDATOR_ADDRESS,
          to: appState.activeContractAddress,
          data: callData,
          gas: "0x186a0"
        }
      ]);
    }

    showToast(`set(${newValInput}) broadcasted! Waiting for next 2s block...`, "info");
    await waitForReceipt(txHash);

    showToast(`Storage value successfully set to ${newValInput}!`, "success");
    await refreshContractValue();
  } catch (err) {
    showToast(`set() failed: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Execute set() Transaction";
  }
}

// ── Native Transfer Module ───────────────────────────────────
async function handleDirectTransfer() {
  const dest = document.getElementById("transfer-to-addr").value.trim();
  const amt = document.getElementById("transfer-amount").value;
  const senderMode = document.getElementById("transfer-sender-mode").value;
  const btn = document.getElementById("btn-send-transfer");
  const statusBox = document.getElementById("transfer-status-box");
  const statusTitle = document.getElementById("transfer-status-title");
  const statusHash = document.getElementById("transfer-tx-hash");

  if (!dest || !dest.startsWith("0x") || dest.length !== 42) {
    showToast("Please provide a valid 42-char recipient address.", "error");
    return;
  }

  btn.disabled = true;
  btn.innerText = "Broadcasting...";
  statusBox.style.display = "block";
  statusTitle.innerText = "⏳ Submitting transfer...";

  try {
    const weiHex = toWeiHex(amt);
    let txHash;

    if (senderMode === "injected" && window.ethereum && appState.connectedAddress) {
      txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: appState.connectedAddress, to: dest, value: weiHex }]
      });
    } else {
      txHash = await rpcCall("eth_sendTransaction", [
        { from: CONFIG.VALIDATOR_ADDRESS, to: dest, value: weiHex }
      ]);
    }

    statusTitle.innerText = "⏳ Waiting for block confirmation...";
    statusHash.innerText = `Tx Hash: ${txHash}`;

    await waitForReceipt(txHash);
    statusTitle.innerText = `✅ Sent ${amt} C99 successfully!`;
    statusTitle.style.color = "var(--accent-emerald)";
    showToast(`Transfer of ${amt} C99 confirmed!`, "success");
    updateValidatorBalance();
  } catch (err) {
    statusTitle.innerText = "❌ Transfer Failed";
    statusTitle.style.color = "var(--accent-rose)";
    statusHash.innerText = err.message;
    showToast(`Transfer failed: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Broadcast Transfer";
  }
}

// ── Raw JSON-RPC Debugger ─────────────────────────────────────
function initRpcConsole() {
  document.querySelectorAll(".rpc-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const method = btn.getAttribute("data-method");
      const params = JSON.parse(btn.getAttribute("data-params") || "[]");
      const payload = { jsonrpc: "2.0", method, params, id: Date.now() };
      document.getElementById("rpc-input-json").value = JSON.stringify(payload, null, 2);
    });
  });

  document.getElementById("btn-send-raw-rpc").addEventListener("click", async () => {
    const rawInput = document.getElementById("rpc-input-json").value;
    const outputElem = document.getElementById("rpc-output-pre");
    outputElem.innerText = "Executing RPC call...";

    try {
      const parsed = JSON.parse(rawInput);
      const start = performance.now();
      const res = await rpcCall(parsed.method, parsed.params || []);
      const duration = (performance.now() - start).toFixed(2);
      outputElem.innerText = `// Took ${duration}ms\n` + JSON.stringify(res, null, 2);
    } catch (err) {
      outputElem.innerText = `// Error:\n` + err.message;
    }
  });

  document.getElementById("btn-clear-rpc-output").addEventListener("click", () => {
    document.getElementById("rpc-output-pre").innerText = "Response will appear here...";
  });
}

// ── Application Initialization ───────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initRpcConsole();
  updateContractUI();

  // Button Listeners
  document.getElementById("btn-add-metamask").addEventListener("click", addChain99ToMetaMask);
  document.getElementById("btn-connect-wallet").addEventListener("click", connectBrowserWallet);
  document.getElementById("btn-send-faucet").addEventListener("click", handleFaucetRequest);
  document.getElementById("btn-deploy-contract").addEventListener("click", deployStorageContract);
  document.getElementById("btn-refresh-val").addEventListener("click", refreshContractValue);
  document.getElementById("btn-execute-set").addEventListener("click", executeSetContract);
  document.getElementById("btn-send-transfer").addEventListener("click", handleDirectTransfer);

  // Faucet helpers
  document.getElementById("btn-faucet-use-connected").addEventListener("click", () => {
    if (appState.connectedAddress) {
      document.getElementById("faucet-recipient").value = appState.connectedAddress;
    } else {
      connectBrowserWallet();
    }
  });

  document.querySelectorAll(".quick-amt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("faucet-amount").value = btn.getAttribute("data-val");
    });
  });

  // Contract Address copy/load
  document.getElementById("btn-copy-contract-addr").addEventListener("click", () => {
    if (appState.activeContractAddress) {
      navigator.clipboard.writeText(appState.activeContractAddress);
      showToast("Contract address copied to clipboard!", "success");
    }
  });

  document.getElementById("btn-load-custom-addr").addEventListener("click", () => {
    const addr = prompt("Enter existing Storage contract address (0x...):");
    if (addr && addr.startsWith("0x") && addr.length === 42) {
      appState.activeContractAddress = addr;
      localStorage.setItem("chain99_storage_address", addr);
      updateContractUI();
      refreshContractValue();
      showToast("Contract address loaded!", "success");
    }
  });

  // Start polling
  updateNetworkStatus();
  setInterval(updateNetworkStatus, 1800);
});
