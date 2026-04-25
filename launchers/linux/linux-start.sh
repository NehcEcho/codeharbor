#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "[CodeHarbor] Starting manual Linux stack..."

if ! command -v npm >/dev/null 2>&1; then
  echo "[CodeHarbor] npm was not found. Please install Node.js first."
  exit 1
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "[CodeHarbor] opencode was not found. Please install the OpenCode CLI first."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[CodeHarbor] Installing dependencies..."
  npm install
fi

chmod +x docs/deployment/start-manual.sh
exec ./docs/deployment/start-manual.sh
