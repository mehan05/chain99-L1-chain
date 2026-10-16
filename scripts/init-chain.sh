#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$DIR/.."

echo "Initializing Node 1..."
$BASE_DIR/geth/geth init --datadir $BASE_DIR/data/node1 $BASE_DIR/geth/genesis.json

echo "Initializing Node 2..."
$BASE_DIR/geth/geth init --datadir $BASE_DIR/data/node2 $BASE_DIR/geth/genesis.json

echo "Chain initialized."
