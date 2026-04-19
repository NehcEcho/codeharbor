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
- start the web UI on port `1657`
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
- start the Vite web UI on port `1657`
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
