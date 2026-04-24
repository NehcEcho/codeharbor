# Deployment

## Docker Compose

Start:

```bash
./docs/deployment/start-compose.sh
```

The app will be available at `http://localhost:1657`.

Stop:

```bash
./docs/deployment/stop-compose.sh
```

Direct commands still work too:

```bash
docker compose up -d --build
docker compose down
```

## How it works

- The container serves the built frontend from `dist/`
- The Node runtime in `scripts/server.mjs` also proxies `/api/opencode/*`
- The browser still sends these headers to the app container:
  - `x-opencode-base-url`
  - `x-opencode-username`
  - `x-opencode-password`
- The container forwards requests to your OpenCode server using Basic Auth

## Important

- The OpenCode server is not bundled into the Compose stack
- You still need a reachable OpenCode server, for example:

```bash
OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD=your-password opencode serve --hostname 0.0.0.0 --port 1656
```

- Then connect from the UI with something like:
  - `Server URL`: `http://host.docker.internal:1656` if OpenCode runs on the same machine as Docker Desktop
  - or the LAN IP of the machine running OpenCode

## Optional image build

```bash
docker build -t opencode-remote .
docker run --rm -p 1657:1657 opencode-remote
```

## Systemd helpers

Install and start both services:

```bash
chmod +x docs/deployment/start-systemd.sh
./docs/deployment/start-systemd.sh
```

Stop both services:

```bash
chmod +x docs/deployment/stop-systemd.sh
./docs/deployment/stop-systemd.sh
```

Rebuild frontend and restart both services:

```bash
chmod +x docs/deployment/restart-systemd.sh
./docs/deployment/restart-systemd.sh
```

## Manual background helpers

Start OpenCode plus the production web server without Compose or systemd:

```bash
chmod +x docs/deployment/start-manual.sh
./docs/deployment/start-manual.sh
```

Stop the manual background processes:

```bash
chmod +x docs/deployment/stop-manual.sh
./docs/deployment/stop-manual.sh
```

Manual helper logs are written to:

- `/tmp/codeharbor-opencode.log`
- `/tmp/codeharbor-web.log`
