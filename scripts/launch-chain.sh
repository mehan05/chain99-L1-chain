#!/bin/bash
# =============================================================
# Chain99 — One-Shot L1 Launcher (Geth 1.13.x compatible)
# =============================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$DIR/.."
GETH="$BASE_DIR/geth/geth"
GENESIS="$BASE_DIR/geth/genesis.json"
DATADIR="$BASE_DIR/data/node1"
PASSWORD_FILE="$BASE_DIR/geth/password.txt"
VALIDATOR="0x86fcDCaF0a0C69C30D589e29F85a44a03A40A904"
LOG_FILE="$BASE_DIR/node1.log"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        Chain99 L1 Devnet             ║"
echo "║   Chain ID : 9999  |  Token : C99    ║"
echo "║   Consensus: Clique PoA (2s blocks)  ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── 1. Kill stale geth processes ────────────────────────────────
pkill -f "geth.*networkid 9999" 2>/dev/null || true
pkill -f "geth.*datadir.*node1" 2>/dev/null  || true
sleep 1

# ── 2. Init chain if not already done ──────────────────────────
if [ ! -d "$DATADIR/geth/chaindata" ]; then
  echo "⚙️  First run — initialising chain from genesis..."
  $GETH init --datadir "$DATADIR" "$GENESIS"
  echo "✅ Chain initialised."
else
  echo "✅ Chain already initialised — skipping init."
fi

# ── 3. Start the mining node ───────────────────────────────────
echo ""
echo "🚀 Starting Chain99 Node 1 (miner + RPC)..."
echo "   RPC  → http://127.0.0.1:8545"
echo "   Logs → $LOG_FILE"
echo ""

# Geth 1.13.x: use --unlock + --password but drop personal API
# Add --vhosts * to allow any virtual host header
$GETH \
  --datadir "$DATADIR" \
  --networkid 9999 \
  --port 30303 \
  --mine \
  --miner.etherbase "$VALIDATOR" \
  --unlock "$VALIDATOR" \
  --password "$PASSWORD_FILE" \
  --allow-insecure-unlock \
  --http \
  --http.addr 0.0.0.0 \
  --http.port 8545 \
  --http.api "eth,net,web3,miner,txpool" \
  --http.corsdomain "*" \
  --http.vhosts "*" \
  --nodiscover \
  --syncmode full \
  --gcmode archive \
  --verbosity 3 \
  >> "$LOG_FILE" 2>&1 &

GETH_PID=$!
echo "   PID  → $GETH_PID"

# ── 4. Wait for RPC to be ready ────────────────────────────────
echo "⏳ Waiting for RPC to come online..."
for i in $(seq 1 40); do
  RESULT=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://127.0.0.1:8545 2>/dev/null || true)

  if echo "$RESULT" | grep -q "result"; then
    BLOCK=$(echo "$RESULT" | grep -o '"result":"0x[^"]*"' | cut -d'"' -f4)
    echo "✅ RPC is live! (block $((16#${BLOCK#0x})))"
    break
  fi

  # Check if geth is still running
  if ! kill -0 $GETH_PID 2>/dev/null; then
    echo "❌ Geth exited unexpectedly. Check logs:"
    echo "   tail -30 $LOG_FILE"
    tail -20 "$LOG_FILE"
    exit 1
  fi

  sleep 1
  echo "   ... attempt $i/40"
done

echo ""
echo "════════════════════════════════════════"
echo "  Chain99 is running! 🎉"
echo ""
echo "  RPC     : http://127.0.0.1:8545"
echo "  Chain ID: 9999"
echo "  Token   : C99"
echo ""
echo "  To run demo client:"
echo "    cd client && node index.js"
echo ""
echo "  To stop the node:"
echo "    kill $GETH_PID"
echo "  Or: pkill -f 'geth.*9999'"
echo "════════════════════════════════════════"
echo ""

# Keep script alive and stream logs
wait $GETH_PID
