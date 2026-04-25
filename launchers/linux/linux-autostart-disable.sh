#!/usr/bin/env bash
set -euo pipefail

echo "[CodeHarbor] Disabling Linux auto-start with systemd..."

if ! command -v systemctl >/dev/null 2>&1; then
  echo "[CodeHarbor] systemctl was not found. This script requires systemd."
  exit 1
fi

sudo systemctl disable --now codeharbor.service opencode.service
sudo rm -f /etc/systemd/system/codeharbor.service /etc/systemd/system/opencode.service
sudo systemctl daemon-reload

echo "[CodeHarbor] Auto-start disabled and service files removed."
