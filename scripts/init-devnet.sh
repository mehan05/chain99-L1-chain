#!/usr/bin/env bash
# Chain99 Devnet Initializer (Linux / macOS / Git Bash)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Running Chain99 Devnet Initialization..."
cd "$ROOT_DIR"

node scripts/init-devnet.js
echo "Devnet successfully initialized."

