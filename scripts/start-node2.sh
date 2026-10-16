#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$DIR/.."

# Wait for Node 1 to write its enode address to a file, or we just connect manually later.
# For simplicity, we just point Node 2 to a known port and we can add peer manually or through command line.
# We will use attach to get Node 1's enode if we needed, but for now we'll start Node 2 on another port.

echo "Starting Node 2..."
$BASE_DIR/geth/geth \
  --datadir $BASE_DIR/data/node2 \
  --networkid 9999 \
  --port 30304 \
  --http --http.addr 127.0.0.1 --http.port 8546 \
  --http.api "eth,net,web3" \
  --http.corsdomain "*" \
  --nodiscover \
  --bootnodes "enode://ba2d0daae451fa433e49e8861d50bac7bae17ad0595e9453633b1338fb55d10ec9b3fd9d653e3cf03cb792d5642edd289e055d49cb7e9ec39072e86dbacd4e93@127.0.0.1:30303"
