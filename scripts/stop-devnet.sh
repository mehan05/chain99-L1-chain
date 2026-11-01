#!/usr/bin/env bash
# Chain99 Devnet Stopper (Linux / macOS / Git Bash)
set -euo pipefail

echo "Stopping all chain99d validator instances..."
pkill -f chain99d || true
echo "All chain99d instances stopped."

