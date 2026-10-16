#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$DIR/.."

echo "Starting Chain99 Frontend Dashboard on http://localhost:3000 ..."
node "$BASE_DIR/frontend/server.js"
