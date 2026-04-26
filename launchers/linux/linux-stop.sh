#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

echo "[CodeHarbor] Stopping manual Linux stack..."

chmod +x docs/deployment/stop-manual.sh
exec ./docs/deployment/stop-manual.sh
