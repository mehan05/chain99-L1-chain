/**
 * Chain99 4-Validator Devnet Background Runner
 * Spawns each validator as a detached background process.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const BIN_PATH = process.platform === "win32"
  ? path.join(ROOT_DIR, "build", "chain99d.exe")
  : path.join(ROOT_DIR, "build", "chain99d");
const DATA_DIR = path.join(ROOT_DIR, "data");

const NODES = ["node1", "node2", "node3", "node4"];

function main() {
  console.log("================================================================");
  console.log("  🚀 LAUNCHING CHAIN99 4-VALIDATOR DEVNET (DETACHED)");
  console.log("================================================================");

  const pids = {};

  for (const node of NODES) {
    const nodeHome = path.join(DATA_DIR, node);
    const outLog = path.join(nodeHome, "node.out.log");
    const errLog = path.join(nodeHome, "node.err.log");

    const outFd = fs.openSync(outLog, "a");
    const errFd = fs.openSync(errLog, "a");

    console.log(`Starting ${node} (Home: ${nodeHome})...`);

    const child = spawn(
      BIN_PATH,
      ["start", "--home", nodeHome, "--log_level", "info"],
      {
        detached: true,
        stdio: ["ignore", outFd, errFd],
        windowsHide: true,
      }
    );

    child.unref();
    pids[node] = child.pid;
    console.log(`   - ${node} started with PID: ${child.pid}`);
  }

  const pidsFile = path.join(DATA_DIR, "pids.json");
  fs.writeFileSync(pidsFile, JSON.stringify(pids, null, 2));

  console.log("\nAll 4 validators launched in background!");
  console.log(`PIDs written to: ${pidsFile}`);
  console.log("Endpoints:");
  console.log("  Node 1: CometBFT RPC: http://127.0.0.1:26657 | EVM JSON-RPC: http://127.0.0.1:8545");
  console.log("  Node 2: CometBFT RPC: http://127.0.0.1:26667 | EVM JSON-RPC: http://127.0.0.1:8555");
  console.log("  Node 3: CometBFT RPC: http://127.0.0.1:26677 | EVM JSON-RPC: http://127.0.0.1:8565");
  console.log("  Node 4: CometBFT RPC: http://127.0.0.1:26687 | EVM JSON-RPC: http://127.0.0.1:8575");
}

main();

