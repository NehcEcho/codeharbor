#!/usr/bin/env bash
set -euo pipefail

sudo systemctl stop codeharbor.service opencode.service

echo "CodeHarbor systemd services stopped."
