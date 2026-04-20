#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_FILE="$PROJECT_ROOT/.opencode-remote-runtime.json"

if [[ -f "$RUNTIME_FILE" ]]; then
  export RUNTIME_FILE
  SERVER_PID=$(python - <<'PY'
import json
import os
from pathlib import Path
data = json.loads(Path(os.environ["RUNTIME_FILE"]).read_text())
print(data.get("serverPid", ""))
PY
)
  WEB_PID=$(python - <<'PY'
import json
import os
from pathlib import Path
data = json.loads(Path(os.environ["RUNTIME_FILE"]).read_text())
print(data.get("webPid", ""))
PY
)

  [[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" >/dev/null 2>&1 || true
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" >/dev/null 2>&1 || true
  rm -f "$RUNTIME_FILE"
fi

pkill -f "opencode serve --hostname 0.0.0.0 --port 1656" >/dev/null 2>&1 || true
pkill -f "node server.mjs" >/dev/null 2>&1 || true

echo "OpenCode Remote stopped."
