# Docker Compose Deployment

## Start

```bash
docker compose up -d --build
```

The app will be available at `http://localhost:1657`.

## Stop

```bash
docker compose down
```

## How it works

- The container serves the built frontend from `dist/`
- The Node runtime in `server.mjs` also proxies `/api/opencode/*`
- The browser still sends these headers to the app container:
  - `x-opencode-base-url`
  - `x-opencode-username`
  - `x-opencode-password`
- The container forwards requests to your OpenCode server using Basic Auth

## Important

- The OpenCode server is **not** bundled into the Compose stack
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
