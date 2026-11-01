#!/usr/bin/env bash
# Chain99 4-Validator Devnet Starter (Linux / macOS / Git Bash)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BIN_PATH="$ROOT_DIR/build/chain99d"
DATA_DIR="$ROOT_DIR/data"

if [ ! -f "$BIN_PATH" ]; then
    echo "Binary not found at $BIN_PATH. Compiling..."
    cd "$ROOT_DIR"
    go build -o "$BIN_PATH" ./cmd/chain99d
fi

if [ ! -f "$DATA_DIR/node1/config/genesis.json" ]; then
    echo "Devnet not initialized. Running init-devnet..."
    node "$ROOT_DIR/scripts/init-devnet.js"
fi

echo "Stopping any running chain99d instances..."
pkill -f chain99d || true
sleep 1

echo "================================================================"
echo "  🚀 STARTING CHAIN99 4-VALIDATOR DEVNET"
echo "================================================================"

NODES=("node1" "node2" "node3" "node4")

for NODE in "${NODES[@]}"; do
    HOME_DIR="$DATA_DIR/$NODE"
    LOG_FILE="$HOME_DIR/node.log"
    echo "Starting $NODE (Log: $LOG_FILE)..."
    "$BIN_PATH" start --home "$HOME_DIR" --log_level info > "$LOG_FILE" 2>&1 &
done

echo "All 4 validators launched in background!"
echo "Endpoints:"
echo "  Node 1: CometBFT RPC: http://127.0.0.1:26657 | EVM JSON-RPC: http://127.0.0.1:8545"
echo "  Node 2: CometBFT RPC: http://127.0.0.1:26667 | EVM JSON-RPC: http://127.0.0.1:8555"
echo "  Node 3: CometBFT RPC: http://127.0.0.1:26677 | EVM JSON-RPC: http://127.0.0.1:8565"
echo "  Node 4: CometBFT RPC: http://127.0.0.1:26687 | EVM JSON-RPC: http://127.0.0.1:8575"

