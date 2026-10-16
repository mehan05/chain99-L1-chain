// =============================================================
// Chain99 — JSON-RPC Engine
// =============================================================

import { CONFIG } from "./config";

let useProxy = false;

export async function rpcCall(method, params = []) {
  const RPC_URL = CONFIG.RPC_URL || "http://127.0.0.1:8545";
  const PROXY_URL = CONFIG.FALLBACK_PROXY || "/api/rpc";

  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  const targetUrl = useProxy ? PROXY_URL : RPC_URL;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        "bypass-tunnel-reminder": "true",
      },
      body: JSON.stringify(payload),
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
    if (!useProxy) {
      console.warn("Direct RPC failed, switching to /api/rpc proxy...", err);
      useProxy = true;
      return rpcCall(method, params);
    }
    throw err;
  }
}

export function hexToDecimal(hex) {
  if (!hex) return 0;
  return parseInt(hex, 16);
}

export function truncateHash(hash, front = 8, back = 6) {
  if (!hash) return "";
  if (hash.length <= front + back) return hash;
  return `${hash.slice(0, front)}...${hash.slice(-back)}`;
}

export function formatEther(weiHex) {
  try {
    const val = BigInt(weiHex);
    return (Number(val) / 1e18).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  } catch (e) {
    return "0.00";
  }
}

export function toWeiHex(c99Amount) {
  const wei = BigInt(Math.floor(parseFloat(c99Amount) * 1e18));
  return "0x" + wei.toString(16);
}

export async function waitForReceipt(txHash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
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
