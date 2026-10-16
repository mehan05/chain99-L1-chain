#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$DIR/.."

echo "Stopping any existing Geth nodes..."
pkill -f "geth.*networkid 9999" 2>/dev/null || true
sleep 2

echo "Starting Node 1 (RPC + Miner) in the background..."

# setsid runs the process in a new session, detaching it from the current terminal.
# The pipe from 'sleep 999999' ensures geth's standard input stays open.
setsid bash -c "(sleep 999999) | $BASE_DIR/geth/geth \
  --datadir $BASE_DIR/data/node1 \
  --networkid 9999 \
  --port 30303 \
  --mine --miner.etherbase 0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8 \
  --unlock 0xB56269Dab6a306cac2D66462D2BD8D23670fe6b8 \
  --password $BASE_DIR/geth/password.txt \
  --allow-insecure-unlock \
  --http --http.addr 127.0.0.1 --http.port 8545 \
  --http.api 'eth,net,web3,personal,miner,txpool' \
  --http.corsdomain '*' \
  --http.vhosts '*' \
  --nodiscover \
  > $BASE_DIR/node1.log 2>&1" &

echo "Logs are being written to node1.log"
echo "Waiting for RPC to be available..."

for i in {1..30}; do
  if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' http://127.0.0.1:8545 > /dev/null; then
    echo "✅ RPC is live! The node is up and running."
    exit 0
  fi
  sleep 1
done

echo "❌ Failed to connect to RPC."
exit 1
