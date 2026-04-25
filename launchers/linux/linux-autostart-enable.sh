#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "[CodeHarbor] Enabling Linux auto-start with systemd..."

if ! command -v npm >/dev/null 2>&1; then
  echo "[CodeHarbor] npm was not found. Please install Node.js first."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[CodeHarbor] node was not found. Please install Node.js first."
  exit 1
fi

if ! command -v opencode >/dev/null 2>&1; then
  echo "[CodeHarbor] opencode was not found. Please install the OpenCode CLI first."
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "[CodeHarbor] systemctl was not found. This script requires systemd."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[CodeHarbor] Installing dependencies..."
  npm install
fi

echo "[CodeHarbor] Building frontend..."
npm run build

SERVICE_USER="${CODEHARBOR_SERVICE_USER:-${SUDO_USER:-$USER}}"
NODE_PATH="$(command -v node)"
OPENCODE_PATH="$(command -v opencode)"
SYSTEMD_DIR="/etc/systemd/system"
OPENCODE_UNIT_PATH="$SYSTEMD_DIR/opencode.service"
CODEHARBOR_UNIT_PATH="$SYSTEMD_DIR/codeharbor.service"
SERVER_PORT="${OPENCODE_SERVER_PORT:-1656}"
WEB_PORT="${CODEHARBOR_WEB_PORT:-1657}"
HOST_VALUE="${HOST:-0.0.0.0}"
SERVER_USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"
SERVER_PASSWORD="${OPENCODE_SERVER_PASSWORD:-opencode-demo-4096}"

sudo tee "$OPENCODE_UNIT_PATH" >/dev/null <<EOF
[Unit]
Description=OpenCode server
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_ROOT
Environment=OPENCODE_SERVER_USERNAME=$SERVER_USERNAME
Environment=OPENCODE_SERVER_PASSWORD=$SERVER_PASSWORD
ExecStart=$OPENCODE_PATH serve --hostname 0.0.0.0 --port $SERVER_PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo tee "$CODEHARBOR_UNIT_PATH" >/dev/null <<EOF
[Unit]
Description=CodeHarbor web UI
After=network.target opencode.service
Requires=opencode.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_ROOT
Environment=HOST=$HOST_VALUE
Environment=PORT=$WEB_PORT
ExecStart=$NODE_PATH $PROJECT_ROOT/scripts/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now opencode.service
sudo systemctl enable --now codeharbor.service

echo "[CodeHarbor] Auto-start enabled."
echo "[CodeHarbor] Project root: $PROJECT_ROOT"
echo "[CodeHarbor] Service user: $SERVICE_USER"
echo "[CodeHarbor] OpenCode: http://127.0.0.1:$SERVER_PORT"
echo "[CodeHarbor] Web UI:   http://127.0.0.1:$WEB_PORT"
