#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "[CodeHarbor] Restarting manual Linux stack..."

chmod +x docs/deployment/stop-manual.sh
./docs/deployment/stop-manual.sh || true

chmod +x docs/deployment/start-manual.sh
exec ./docs/deployment/start-manual.sh
