# CodeHarbor

CodeHarbor is a web control panel for running and managing `OpenCode` from a browser.

It provides:

- a session list for remote coding tasks
- a chat-style workspace with streaming updates
- a lightweight permission queue on the right side
- local launch scripts for Windows and Linux
- optional Docker Compose deployment

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

Build the app:

```bash
npm run build
```

Run the production Node server after a build:

```bash
npm run start
```

## Default local OpenCode server credentials

The bundled local launch scripts use these defaults:

```text
Server URL: http://127.0.0.1:4096
Username:   opencode
Password:   opencode-demo-4096
```

## Windows launch scripts

### One-click launcher

```bat
start-opencode-remote.cmd
```

This uses the PowerShell helper script to:

- start OpenCode on port `4096`
- start the web UI on port `5173`
- open the browser

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

- start OpenCode on port `4096`
- start the Vite web UI on port `5173`
- try to open a browser
- stop both processes when you press Enter

## Docker Compose

You can also run the web app in Docker:

```bash
docker compose up -d --build
```

Then open:

```text
http://localhost:4173
```

Stop it with:

```bash
docker compose down
```

More notes are in `DEPLOY.md`.

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
