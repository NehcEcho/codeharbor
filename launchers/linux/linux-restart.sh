#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

echo "[CodeHarbor] Restarting manual Linux stack..."

TARGET="${1:-stack}"

chmod +x docs/deployment/stop-manual.sh
./docs/deployment/stop-manual.sh "$TARGET" || true

chmod +x docs/deployment/start-manual.sh
exec ./docs/deployment/start-manual.sh "$TARGET"
