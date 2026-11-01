#!/usr/bin/env bash
# ====================================================================
# Chain99 L1 — Production Validator Backup Script (Linux / Bash)
# IMPORTANT: Protects against double-signing by isolating consensus state!
# ====================================================================
set -euo pipefail

NODE_HOME="${1:-data/node1}"
BACKUP_DIR="${2:-backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TARGET_ARCHIVE="$BACKUP_DIR/chain99_backup_${TIMESTAMP}.tar.gz"

echo "=========================================================="
echo "  💾 CHAIN99 PRODUCTION VALIDATOR BACKUP UTILITY"
echo "=========================================================="

if [ ! -d "$NODE_HOME" ]; then
    echo "Error: Node home directory not found: $NODE_HOME"
    exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Backing up application database from $NODE_HOME to $TARGET_ARCHIVE..."

# Archive data directory EXCLUDING priv_validator_state.json to prevent double-signing!
tar -czf "$TARGET_ARCHIVE" \
    --exclude="priv_validator_state.json" \
    --exclude="priv_validator_key.json" \
    --exclude="node_key.json" \
    --exclude="cs.wal" \
    -C "$NODE_HOME" data config/genesis.json config/config.toml config/app.toml

ARCHIVE_SIZE=$(du -h "$TARGET_ARCHIVE" | cut -f1)
echo "✅ Backup created successfully: $TARGET_ARCHIVE ($ARCHIVE_SIZE)"
echo "⚠️ NOTE: priv_validator_key.json and priv_validator_state.json were safely excluded to prevent accidental double-signing."

