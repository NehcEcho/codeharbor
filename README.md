# CodeHarbor

CodeHarbor is a web control panel for running and managing `OpenCode` from a browser.

It provides:

- a session list for remote coding tasks
- a chat-style workspace with streaming updates
- a lightweight permission queue on the right side
- local launch scripts for Windows and Linux
- optional Docker Compose deployment

## Default ports

This project now uses these local ports by default:

```text
OpenCode server: 1656
Web UI:          1657
```

If you start the bundled scripts, use these values unless you intentionally change the scripts.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS v4
- Node proxy server for `/api/opencode/*`

## Requirements

You need these installed locally:

- Node.js
- npm
- OpenCode CLI (`opencode`)

## Local development

Install dependencies:

```bash
npm install
```

Start the frontend only:

```bash
npm run dev
```

By default the Vite dev server runs on:

```text
http://127.0.0.1:1657
```

Build the app:

```bash
npm run build
```

Run the production Node server after a build:

```bash
npm run start
```

The production server also listens on port `1657` unless overridden with environment variables.

## Default local OpenCode server credentials

The bundled local launch scripts use these defaults:

```text
Server URL: http://127.0.0.1:1656
Username:   opencode
Password:   opencode-demo-4096
```

## Windows launch scripts

### One-click launcher

```bat
start-opencode-remote.cmd
```

This uses the PowerShell helper script to:

- start OpenCode on port `1656`
- build and start the production web UI on port `1657`
- open the browser

Files involved:

- `start-opencode-remote.cmd`
- `start-opencode-remote.ps1`
- `stop-opencode-remote.cmd`
- `stop-opencode-remote.ps1`

### Stop everything

```bat
stop-opencode-remote.cmd
```

## Linux launch scripts

Make them executable first:

```bash
chmod +x start-opencode-remote.sh stop-opencode-remote.sh
```

Start:

```bash
./start-opencode-remote.sh
```

Stop:

```bash
./stop-opencode-remote.sh
```

The Linux launcher will:

- start OpenCode on port `1656`
- build and start the production web UI on port `1657`
- try to open a browser
- stop both processes when you press Enter

Files involved:

- `start-opencode-remote.sh`
- `stop-opencode-remote.sh`

## Docker Compose

You can also run the web app in Docker:

```bash
docker compose up -d --build
```

Then open:

```text
http://localhost:1657
```

Stop it with:

```bash
docker compose down
```

More notes are in `DEPLOY.md`.

## Systemd production startup

For Linux servers, the recommended production setup is `systemd` with `root` services.

### Services

- `systemd/opencode.service`: starts OpenCode on port `1656`
- `systemd/codeharbor.service`: serves the built app on port `1657`

### Install

```bash
sudo cp /root/codeharbor/systemd/opencode.service /etc/systemd/system/
sudo cp /root/codeharbor/systemd/codeharbor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opencode.service
sudo systemctl enable --now codeharbor.service
```

### Stop

```bash
sudo systemctl stop codeharbor.service opencode.service
```

Or run the helper script:

```bash
chmod +x /root/codeharbor/systemd/stop-codeharbor.sh
/root/codeharbor/systemd/stop-codeharbor.sh
```

### Rebuild after frontend changes

`codeharbor.service` serves `dist/`, so rebuild after UI changes:

```bash
cd /root/codeharbor
npm run build
sudo systemctl restart codeharbor.service
```

## Manual OpenCode startup

If you do not want to use the bundled scripts, you can run OpenCode yourself:

```bash
OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD=opencode-demo-4096 opencode serve --hostname 0.0.0.0 --port 1656
```

Then start the frontend separately:

```bash
npm run dev -- --host 0.0.0.0 --port 1657
```

Open the app and connect with:

```text
Server URL: http://127.0.0.1:1656
Username:   opencode
Password:   opencode-demo-4096
```

## Restart guide

If the web UI opens but cannot connect, or the chat stops responding, restart both the OpenCode backend and the web UI.

This section is written so that another session can recover the app without needing any prior context.

### What must be running

This project depends on two separate processes:

1. OpenCode backend
   Port: `1656`
   Purpose: stores sessions, runs the model, executes tools, serves health/status APIs

2. Web UI frontend
   Port: `1657`
   Purpose: serves the browser interface and proxies requests to the backend

If either process is down, the app will appear broken.

### When to use this guide

Use this guide if any of the following happens:

- the browser page opens but shows connection failed
- `http://127.0.0.1:1657` does not load
- the chat stops updating
- the app feels stuck after a crash or restart
- another session needs a safe, known-good way to recover the environment

### Known-good connection values

Use these exact values unless the project was intentionally reconfigured:

```text
OpenCode backend URL: http://127.0.0.1:1656
Web UI URL:          http://127.0.0.1:1657
Username:            opencode
Password:            opencode-demo-4096
```

### Full restart on this Linux setup

Work from the project directory:

```bash
cd /root/codeharbor
```

#### Step 1: Stop old backend and frontend processes

```bash
pkill -f "opencode serve --hostname 0.0.0.0 --port 1656"
pkill -f "vite --host 0.0.0.0 --port 1657"
```

It is fine if either command finds nothing.

#### Step 2: Start the OpenCode backend

```bash
nohup env OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD=opencode-demo-4096 opencode serve --hostname 0.0.0.0 --port 1656 >/tmp/codeharbor-opencode.log 2>&1 </dev/null &
```

What this does:

- starts OpenCode in the background
- binds it to `1656`
- keeps the expected username/password
- writes logs to `/tmp/codeharbor-opencode.log`

#### Step 3: Start the Web UI frontend

Run this from `/root/codeharbor`:

```bash
nohup npm run dev -- --host 0.0.0.0 --port 1657 >/tmp/codeharbor-dev.log 2>&1 </dev/null &
```

What this does:

- starts the Vite dev server in the background
- binds it to `1657`
- writes logs to `/tmp/codeharbor-dev.log`

#### Step 4: Wait a few seconds

The frontend usually takes a few seconds before `1657` is reachable.

#### Step 5: Verify both ports are listening

```bash
ss -ltnp | grep -E '1656|1657'
```

Expected result should include both services:

```text
0.0.0.0:1656  opencode
0.0.0.0:1657  node
```

If one of them is missing, do not guess. Read the related log file first.

#### Step 6: Verify both services directly

Check backend health:

```bash
curl -u opencode:opencode-demo-4096 http://127.0.0.1:1656/global/health
```

Expected: a successful response from OpenCode.

Check frontend HTTP:

```bash
curl -I http://127.0.0.1:1657
```

Expected:

```text
HTTP/1.1 200 OK
```

#### Step 7: Open the browser and reconnect

Open one of these:

```text
http://127.0.0.1:1657
http://107.175.245.34:1657
```

Then connect with:

```text
Server URL: http://127.0.0.1:1656
Username:   opencode
Password:   opencode-demo-4096
```

### Fast copy-paste recovery block

If another session already understands the setup and just needs the shortest reliable recovery sequence, use this block:

```bash
cd /root/codeharbor
pkill -f "opencode serve --hostname 0.0.0.0 --port 1656"
pkill -f "vite --host 0.0.0.0 --port 1657"
nohup env OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD=opencode-demo-4096 opencode serve --hostname 0.0.0.0 --port 1656 >/tmp/codeharbor-opencode.log 2>&1 </dev/null &
nohup npm run dev -- --host 0.0.0.0 --port 1657 >/tmp/codeharbor-dev.log 2>&1 </dev/null &
sleep 5
ss -ltnp | grep -E '1656|1657'
curl -u opencode:opencode-demo-4096 http://127.0.0.1:1656/global/health
curl -I http://127.0.0.1:1657
```

### Log files to inspect if restart fails

Backend log:

```text
/tmp/codeharbor-opencode.log
```

Frontend log:

```text
/tmp/codeharbor-dev.log
```

Quick log inspection:

```bash
sed -n '1,120p' /tmp/codeharbor-opencode.log
sed -n '1,120p' /tmp/codeharbor-dev.log
```

### Common pitfalls

- If `1657` is down but `1656` is healthy, the browser page itself will fail even though OpenCode is alive.
- If `1656` is down but `1657` is healthy, the page will open but connection inside the app will fail.
- Always use `127.0.0.1:1656` in the UI, not `0.0.0.0:1656`.
- Start the frontend from `/root/codeharbor`, not from another directory.
- If the browser still shows stale state after a good restart, refresh the page manually.
- If a session looks empty after a crash, reconnect and re-open the session before assuming data is gone.

### Minimal diagnosis checklist for another session

1. Confirm `1656` is listening.
2. Confirm `1657` is listening.
3. Confirm backend health on `127.0.0.1:1656` succeeds.
4. Confirm frontend HTTP on `127.0.0.1:1657` returns `200 OK`.
5. Open the browser and reconnect with the known-good credentials.
6. If still broken, inspect `/tmp/codeharbor-opencode.log` and `/tmp/codeharbor-dev.log` before changing code.

### Notes for other sessions

- Backend log: `/tmp/codeharbor-opencode.log`
- Frontend log: `/tmp/codeharbor-dev.log`
- Backend port: `1656`
- Frontend port: `1657`
- Connection settings in the UI should stay:

```text
Server URL: http://127.0.0.1:1656
Username:   opencode
Password:   opencode-demo-4096
```

## Project structure

```text
src/                     app source
tests/                   Playwright tests
server.mjs               production static server and OpenCode proxy
start-opencode-remote.*  local startup scripts
stop-opencode-remote.*   local shutdown scripts
docker-compose.yml       container deployment
Dockerfile               production image
```

## Notes

- The UI connects to OpenCode through the built-in proxy path `/api/opencode/*`
- The right panel is reserved for permission-related actions
- Session data and server config are stored in the browser locally

## Common workflow

1. Start the bundled script for your platform
2. Open `http://127.0.0.1:1657`
3. Confirm the connection settings point to `http://127.0.0.1:1656`
4. Start or resume a coding session
