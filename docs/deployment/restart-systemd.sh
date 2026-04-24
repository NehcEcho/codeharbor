#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

npm run build
sudo systemctl restart opencode.service
sudo systemctl restart codeharbor.service

echo "CodeHarbor systemd services rebuilt and restarted."
