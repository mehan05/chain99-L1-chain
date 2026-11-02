/**
 * Chain99 L1 — Multi-Validator Process & Node Controller
 * Enables interactive toggling (stopping / restarting) of individual validator nodes
 * during stress testing to verify Byzantine Fault Tolerance (BFT) and consensus resilience.
 */

import { execSync } from "child_process";
import path from "path";
import fs from "fs";

export const VALIDATOR_NODES = [
  {
    id: "node1",
    name: "Validator A (Primary RPC)",
    moniker: "validatorA",
    operatorAddress: "c99valoper18v9ejkkqn83pm5gcdqkxgpjt02e2fef7wf2tn9",
    consensusAddress: "8533EBA770CE271CCFE42657D749D94C16F1ACDB",
    evmPort: 8545,
    cometPort: 26657,
    restPort: 1317,
    votingPower: 10500,
    votingPercent: 20.8,
    isPrimaryRpc: true,
  },
  {
    id: "node2",
    name: "Validator B (Proposer Leader)",
    moniker: "validatorB",
    operatorAddress: "c99valoper1r9dck9unakj56yc6g6u0nmfn6pqz89l7n678q5",
    consensusAddress: "534D350A4A64F97E5DCB98697F216E55400E1F00",
    evmPort: 8555,
    cometPort: 26667,
    restPort: 1319,
    votingPower: 20000,
    votingPercent: 39.6,
    isPrimaryRpc: false,
  },
  {
    id: "node3",
    name: "Validator C (Worker Node)",
    moniker: "validatorC",
    operatorAddress: "c99valoper1pq5suzunkygxhkxt5va9gk0zap677eee2knc0j",
    consensusAddress: "6AEFB97E29C1EB90B80774EE0BED1E0EFA51A583",
    evmPort: 8565,
    cometPort: 26677,
    restPort: 1321,
    votingPower: 10000,
    votingPercent: 19.8,
    isPrimaryRpc: false,
  },
  {
    id: "node4",
    name: "Validator D (Worker Node)",
    moniker: "validatorD",
    operatorAddress: "c99valoper12tmwmlw7n7c7zu7cgdluzandq95uwe5vl5cehh",
    consensusAddress: "9675E24C11EB3CC1F023A6EA3794DEBE35DE41CC",
    evmPort: 8575,
    cometPort: 26687,
    restPort: 1323,
    votingPower: 10005,
    votingPercent: 19.8,
    isPrimaryRpc: false,
  },
];

function getProjectRoot() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "build", "chain99d.exe"))) {
    return cwd;
  }
  const parent = path.resolve(cwd, "..");
  if (fs.existsSync(path.join(parent, "build", "chain99d.exe"))) {
    return parent;
  }
  return cwd;
}

export async function getNodeStatuses() {
  // 1. Get all running chain99d process PIDs and their command lines
  let procs = [];
  try {
    const psCmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chain99d.exe' } | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;
    const raw = execSync(psCmd, { encoding: "utf-8", timeout: 4000 });
    const parsed = JSON.parse(raw);
    procs = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    procs = [];
  }

  // 2. Query each node RPC
  const statuses = await Promise.all(
    VALIDATOR_NODES.map(async (v) => {
      // Find matching PID by home directory path in CommandLine
      const match = procs.find((p) => p.CommandLine && p.CommandLine.includes(`\\${v.id}`) || p.CommandLine?.includes(`/${v.id}`));
      const pid = match ? match.ProcessId : null;

      let isRpcReachable = false;
      let latestBlockHeight = 0;
      let catchingUp = false;

      try {
        const res = await fetch(`http://127.0.0.1:${v.cometPort}/status`, {
          cache: "no-store",
          signal: AbortSignal.timeout(1200),
        }).then((r) => r.json());

        if (res?.result?.sync_info) {
          isRpcReachable = true;
          latestBlockHeight = parseInt(res.result.sync_info.latest_block_height || "0", 10);
          catchingUp = res.result.sync_info.catching_up || false;
        }
      } catch {
        isRpcReachable = false;
      }

      return {
        ...v,
        isOnline: isRpcReachable || !!pid,
        isRpcReachable,
        pid,
        latestBlockHeight,
        catchingUp,
      };
    })
  );

  return statuses;
}

export async function stopNode(nodeId) {
  const statuses = await getNodeStatuses();
  const target = statuses.find((s) => s.id === nodeId);
  if (!target) {
    throw new Error(`Validator node ${nodeId} not recognized`);
  }

  if (!target.pid && !target.isOnline) {
    return { success: true, message: `Node ${nodeId} is already offline`, status: target };
  }

  if (target.pid) {
    try {
      execSync(`taskkill /PID ${target.pid} /F`, { encoding: "utf-8", timeout: 4000 });
    } catch {
      try {
        process.kill(target.pid, "SIGKILL");
      } catch {}
    }
  }

  return {
    success: true,
    action: "stop",
    nodeId,
    name: target.name,
    message: `Validator ${target.name} stopped successfully (Simulating node dropout)`,
  };
}

export async function startNode(nodeId) {
  const statuses = await getNodeStatuses();
  const target = statuses.find((s) => s.id === nodeId);
  if (!target) {
    throw new Error(`Validator node ${nodeId} not recognized`);
  }

  if (target.isOnline && target.pid) {
    return { success: true, message: `Node ${nodeId} is already running (PID: ${target.pid})`, status: target };
  }

  const root = getProjectRoot();
  const binPath = path.join(root, "build", "chain99d.exe");
  const homePath = path.join(root, "data", nodeId);

  if (!fs.existsSync(binPath)) {
    throw new Error(`chain99d binary not found at ${binPath}`);
  }
  if (!fs.existsSync(homePath)) {
    throw new Error(`Node home directory not found at ${homePath}`);
  }

  const cmd = `\\"${binPath}\\" start --home \\"${homePath}\\" --log_level info`;
  const psCmd = `powershell -NoProfile -Command "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmd}' }"`;

  execSync(psCmd, { encoding: "utf-8", timeout: 6000 });

  return {
    success: true,
    action: "start",
    nodeId,
    name: target.name,
    message: `Validator ${target.name} started successfully (Reconnecting to P2P mesh)`,
  };
}

export async function toggleNode(nodeId) {
  const statuses = await getNodeStatuses();
  const target = statuses.find((s) => s.id === nodeId);
  if (!target) {
    throw new Error(`Validator node ${nodeId} not recognized`);
  }

  if (target.isOnline) {
    return await stopNode(nodeId);
  } else {
    return await startNode(nodeId);
  }
}

