#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

sudo cp "$PROJECT_ROOT/systemd/opencode.service" /etc/systemd/system/
sudo cp "$PROJECT_ROOT/systemd/codeharbor.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opencode.service
sudo systemctl enable --now codeharbor.service

echo "CodeHarbor systemd services started."
