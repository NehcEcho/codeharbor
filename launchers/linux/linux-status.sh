#!/usr/bin/env bash
set -euo pipefail

SERVER_PORT="${OPENCODE_SERVER_PORT:-1656}"
WEB_PORT="${CODEHARBOR_WEB_PORT:-1657}"
SERVER_URL="http://127.0.0.1:${SERVER_PORT}/global/health"
WEB_URL="http://127.0.0.1:${WEB_PORT}/index.html"
USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"
PASSWORD="${OPENCODE_SERVER_PASSWORD:-opencode-demo-4096}"

server_up=false
web_up=false

if command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 3 -u "${USERNAME}:${PASSWORD}" "$SERVER_URL" >/dev/null 2>&1; then
    server_up=true
  fi
  if curl -fsS --max-time 3 "$WEB_URL" >/dev/null 2>&1; then
    web_up=true
  fi
else
  echo "[CodeHarbor] curl was not found. Unable to probe service status."
  exit 1
fi

echo "OpenCode: ${server_up} (http://127.0.0.1:${SERVER_PORT})"
echo "Web UI:   ${web_up} (http://127.0.0.1:${WEB_PORT})"
