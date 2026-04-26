#!/bin/sh
set -eu

SERVER_PORT="${OPENCODE_SERVER_PORT:-1656}"
WEB_PORT="${CODEHARBOR_WEB_PORT:-1657}"

pkill -f "opencode serve --hostname 0.0.0.0 --port ${SERVER_PORT}" >/dev/null 2>&1 || true
pkill -f "node .*scripts/server.mjs" >/dev/null 2>&1 || true

echo "Manual services stopped for ports ${SERVER_PORT} and ${WEB_PORT}."
