#!/usr/bin/env bash
# Chain99 Devnet Reset Tool (Linux / macOS / Git Bash)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Stopping running validators..."
bash "$SCRIPT_DIR/stop-devnet.sh"
sleep 2

echo "Re-initializing 4-validator devnet..."
cd "$ROOT_DIR"
node scripts/init-devnet.js

echo "Devnet reset and ready."

