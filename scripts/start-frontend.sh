#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$DIR/.."

echo "Starting Chain99 Next.js Frontend Dashboard on http://localhost:3000 ..."
cd "$BASE_DIR/frontend-next" && npm run dev
