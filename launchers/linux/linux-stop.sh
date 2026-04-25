#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "[CodeHarbor] Stopping manual Linux stack..."

chmod +x docs/deployment/stop-manual.sh
exec ./docs/deployment/stop-manual.sh
