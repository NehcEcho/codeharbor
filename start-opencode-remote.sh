#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

OPENCODE_SERVER_USERNAME="opencode"
OPENCODE_SERVER_PASSWORD="opencode-demo-4096"
OPENCODE_SERVER_PORT="4096"
OPENCODE_WEB_PORT="5173"
SERVER_URL="http://127.0.0.1:${OPENCODE_SERVER_PORT}"
WEB_URL="http://127.0.0.1:${OPENCODE_WEB_PORT}"
RUNTIME_FILE="$PROJECT_ROOT/.opencode-remote-runtime.json"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$RUNTIME_FILE"
}

wait_for_http_ok() {
  local url="$1"
  local auth_header="${2:-}"
  local timeout=30
  local start
  start=$(date +%s)

  while true; do
    if [[ -n "$auth_header" ]]; then
      if curl -fsS -H "Authorization: $auth_header" "$url" >/dev/null 2>&1; then
        return 0
      fi
    else
      if curl -fsS "$url" >/dev/null 2>&1; then
        return 0
      fi
    fi

    if (( $(date +%s) - start >= timeout )); then
      echo "Timed out waiting for $url" >&2
      exit 1
    fi

    sleep 0.5
  done
}

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$WEB_URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$WEB_URL" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

AUTH_HEADER="Basic $(printf '%s' "${OPENCODE_SERVER_USERNAME}:${OPENCODE_SERVER_PASSWORD}" | base64 | tr -d '\n')"

pkill -f "opencode serve --hostname 0.0.0.0 --port ${OPENCODE_SERVER_PORT}" >/dev/null 2>&1 || true
pkill -f "vite --host 0.0.0.0 --port ${OPENCODE_WEB_PORT}" >/dev/null 2>&1 || true

OPENCODE_SERVER_USERNAME="$OPENCODE_SERVER_USERNAME" \
OPENCODE_SERVER_PASSWORD="$OPENCODE_SERVER_PASSWORD" \
opencode serve --hostname 0.0.0.0 --port "$OPENCODE_SERVER_PORT" >/tmp/opencode-remote-server.log 2>&1 &
SERVER_PID=$!

wait_for_http_ok "$SERVER_URL/global/health" "$AUTH_HEADER"

npm run dev -- --host 0.0.0.0 --port "$OPENCODE_WEB_PORT" >/tmp/opencode-remote-web.log 2>&1 &
WEB_PID=$!

wait_for_http_ok "$WEB_URL"

cat > "$RUNTIME_FILE" <<EOF
{
  "serverUrl": "$SERVER_URL",
  "webUrl": "$WEB_URL",
  "username": "$OPENCODE_SERVER_USERNAME",
  "password": "$OPENCODE_SERVER_PASSWORD",
  "serverPid": $SERVER_PID,
  "webPid": $WEB_PID
}
EOF

open_browser

echo
echo "OpenCode Remote is ready."
echo "Web UI:     $WEB_URL"
echo "Server URL: $SERVER_URL"
echo "Username:   $OPENCODE_SERVER_USERNAME"
echo "Password:   $OPENCODE_SERVER_PASSWORD"
echo
echo "Press Enter to stop the web app and OpenCode server."
read -r _
