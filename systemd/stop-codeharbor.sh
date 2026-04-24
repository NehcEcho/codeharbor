#!/usr/bin/env bash
set -euo pipefail

systemctl stop codeharbor.service
systemctl stop opencode.service
