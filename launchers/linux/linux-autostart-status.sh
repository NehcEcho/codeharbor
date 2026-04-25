#!/usr/bin/env bash
set -euo pipefail

echo "[CodeHarbor] Checking Linux auto-start services..."

if ! command -v systemctl >/dev/null 2>&1; then
  echo "[CodeHarbor] systemctl was not found. This script requires systemd."
  exit 1
fi

systemctl status opencode.service --no-pager || true
echo
systemctl status codeharbor.service --no-pager || true
