#!/usr/bin/env bash
# Build server, frontend and python detector env; fetch model if missing.
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npx tsc
npm run build
[ -d .venv ] || python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -e ./ai
scripts/fetch-model.sh
echo "Build complete. Run: PATH=\"\$PWD/.venv/bin:\$PATH\" node lib/server/index.js"
