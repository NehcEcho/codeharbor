#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$PROJECT_ROOT"

SERVER_PORT="${OPENCODE_SERVER_PORT:-1656}"
WEB_PORT="${CODEHARBOR_WEB_PORT:-1657}"
USERNAME="${OPENCODE_SERVER_USERNAME:-opencode}"
PASSWORD="${OPENCODE_SERVER_PASSWORD:-opencode-demo-4096}"
TARGET="${1:-stack}"

ensure_dependencies() {
  if [ ! -d "node_modules" ]; then
    echo "[CodeHarbor] Installing dependencies..."
    npm install
  fi
}

start_opencode() {
  nohup env OPENCODE_SERVER_USERNAME="$USERNAME" OPENCODE_SERVER_PASSWORD="$PASSWORD" \
    opencode serve --hostname 0.0.0.0 --port "$SERVER_PORT" \
    > /tmp/codeharbor-opencode.log 2>&1 < /dev/null &
}

start_web() {
  ensure_dependencies
  npm run build
  nohup env HOST=0.0.0.0 PORT="$WEB_PORT" npm run start \
    > /tmp/codeharbor-web.log 2>&1 < /dev/null &
}

case "$TARGET" in
  opencode)
    start_opencode
    echo "Manual OpenCode service started."
    echo "Server URL: http://127.0.0.1:${SERVER_PORT}"
    ;;
  web)
    start_web
    echo "Manual web service started."
    echo "Web UI:     http://127.0.0.1:${WEB_PORT}"
    ;;
  stack|full)
    start_opencode
    start_web
    echo "Manual services started."
    echo "Web UI:     http://127.0.0.1:${WEB_PORT}"
    echo "Server URL: http://127.0.0.1:${SERVER_PORT}"
    ;;
  *)
    echo "Unknown start target: $TARGET" >&2
    exit 1
    ;;
esac
