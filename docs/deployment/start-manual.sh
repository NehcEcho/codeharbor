#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

SERVER_PORT="${OPENCODE_SERVER_PORT:-1656}"
WEB_PORT="${CODEHARBOR_WEB_PORT:-1657}"
USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"
PASSWORD="${OPENCODE_SERVER_PASSWORD:-opencode-demo-4096}"

nohup env OPENCODE_SERVER_USERNAME="$USERNAME" OPENCODE_SERVER_PASSWORD="$PASSWORD" \
  opencode serve --hostname 0.0.0.0 --port "$SERVER_PORT" \
  > /tmp/codeharbor-opencode.log 2>&1 < /dev/null &

npm run build

nohup env HOST=0.0.0.0 PORT="$WEB_PORT" npm run start \
  > /tmp/codeharbor-web.log 2>&1 < /dev/null &

echo "Manual services started."
echo "Web UI:     http://127.0.0.1:${WEB_PORT}"
echo "Server URL: http://127.0.0.1:${SERVER_PORT}"
