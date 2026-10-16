#!/bin/bash
# =============================================================
# Chain99 L1 — One-Shot Setup Script
# Run this once on a fresh clone to get everything ready.
# =============================================================
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GETH_DIR="$DIR/geth"
GETH_BIN="$GETH_DIR/geth"
GETH_VERSION="1.13.14-stable"
GETH_COMMIT="2bd6bd01"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Chain99 L1 — Setup               ║"
echo "║   Chain ID : 9999  |  Token : C99         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Check OS ──────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Linux" ]; then
  echo "❌ This script targets Linux. For macOS/Windows, download Geth manually."
  echo "   https://geth.ethereum.org/downloads"
  exit 1
fi

if [ "$ARCH" = "x86_64" ]; then
  GETH_ARCH="amd64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
  GETH_ARCH="arm64"
else
  echo "❌ Unsupported architecture: $ARCH"
  exit 1
fi

# ── 2. Download Geth binary if not present ───────────────────
if [ ! -f "$GETH_BIN" ]; then
  echo "📥 Downloading Geth ${GETH_VERSION} (${GETH_ARCH})..."
  GETH_URL="https://gethstore.blob.core.windows.net/builds/geth-linux-${GETH_ARCH}-${GETH_VERSION}-${GETH_COMMIT}.tar.gz"
  TMP_TAR="/tmp/geth.tar.gz"

  curl -L "$GETH_URL" -o "$TMP_TAR"
  tar -xzf "$TMP_TAR" -C /tmp/
  EXTRACTED_DIR=$(tar -tzf "$TMP_TAR" | head -1 | cut -f1 -d"/")
  cp "/tmp/${EXTRACTED_DIR}/geth" "$GETH_BIN"
  chmod +x "$GETH_BIN"
  rm -rf "$TMP_TAR" "/tmp/${EXTRACTED_DIR}"
  echo "✅ Geth downloaded → $GETH_BIN"
else
  echo "✅ Geth binary already present — skipping download."
fi

# ── 3. Verify Geth ───────────────────────────────────────────
echo "   $($GETH_BIN version | head -2 | tr '\n' ' ')"

# ── 4. Initialise chain data from genesis ────────────────────
DATADIR="$DIR/data/node1"
GENESIS="$GETH_DIR/genesis.json"

if [ ! -d "$DATADIR/geth/chaindata" ]; then
  echo ""
  echo "⚙️  Initialising Chain99 from genesis.json..."
  mkdir -p "$DATADIR"
  "$GETH_BIN" init --datadir "$DATADIR" "$GENESIS"
  echo "✅ Chain initialised."
else
  echo "✅ Chain already initialised — skipping init."
fi

# ── 5. Install Node.js dependencies ──────────────────────────
echo ""
echo "📦 Installing client dependencies..."
cd "$DIR/client" && npm install --silent
echo "✅ Client deps installed."

if [ -d "$DIR/frontend-next" ]; then
  echo "📦 Installing frontend-next dependencies..."
  cd "$DIR/frontend-next" && npm install --silent
  echo "✅ Frontend-next deps installed."
fi

# ── 6. Done ──────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
echo "  ✅  Setup complete! Chain99 is ready."
echo ""
echo "  To start the blockchain node:"
echo "    ./scripts/launch-chain.sh"
echo ""
echo "  To start the Next.js frontend (new tab):"
echo "    cd frontend-next && npm run dev"
echo ""
echo "  To start the vanilla frontend (new tab):"
echo "    cd frontend && node server.js"
echo ""
echo "  Dashboard → http://localhost:3000"
echo "  RPC       → http://127.0.0.1:8545"
echo "════════════════════════════════════════════"
echo ""
