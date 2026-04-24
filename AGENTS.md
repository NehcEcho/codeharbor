# AGENTS.md

## Commands

- Install deps: `npm install`
- Main verification: `npm run build`
- Dev server: `npm run dev` on `0.0.0.0:1657`
- Production server: `npm run start` serves `dist/` via `scripts/server.mjs`
- E2E entrypoint: `npm run test:e2e`

## Verification Notes

- There is no lint script in `package.json`; do not invent one.
- `npm run build` is the repo's real baseline check because it runs `tsc && vite build`.
- `npm run start` requires a fresh `dist/`. After UI changes, rebuild before testing production mode or restarting `codeharbor.service`.
- The checked-in Playwright spec in `tests/app.spec.ts` asserts older UI copy and controls; treat it as stale until updated.

## Runtime Shape

- This repo is a single Vite + React app, not a monorepo.
- Browser entrypoint is `src/main.tsx`; `src/App.tsx` is the main state hub for sessions, streaming events, queueing, retry/abort, model selection, commands, permissions, and settings data loading.
- API access is centralized in `src/lib/opencode.ts`. Keep new OpenCode HTTP calls there instead of sprinkling `fetch` across components.
- Browser persistence lives in `src/lib/storage.ts`:
  - connection config is stored in `localStorage`
  - selected model is stored in `sessionStorage`

## Proxy / Networking

- Both dev and production use the same proxy prefix: `/api/opencode`.
- The proxy expects these headers from the frontend: `x-opencode-base-url`, `x-opencode-username`, `x-opencode-password`.
- The proxy converts those headers into upstream Basic Auth. If backend calls break, inspect `vite.config.ts` for dev and `scripts/server.mjs` for production before changing UI code.
- Event streaming is proxied too; both proxy implementations have explicit `text/event-stream` handling.

## Default Local Setup

- Default OpenCode port: `1656`
- Default web UI port: `1657`
- Default local credentials used by the stack runner:
  - username: `opencode`
  - password: `opencode-demo-4096`

## Launch Scripts

- `npm run stack -- up` is the highest-signal local startup flow.
- It does more than start the frontend: it stops old managed processes, starts `opencode serve`, waits for backend health, runs `npm run build`, then starts the production web server.
- Runtime state lives under `.runtime/local-stack.json` and logs live under `.runtime/logs/`.

## Deployment Notes

- `systemd/codeharbor.service` serves the built app, so frontend-only changes still require `npm run build` and a service restart.
- `docker-compose.yml` maps host `1657:1657`, but `Dockerfile` still exposes and defaults runtime `PORT=4173`. If Docker behavior looks wrong, check the container env first instead of assuming Vite config is at fault.

## UI Change Guidance

- Most user-visible wiring passes through `MainLayout -> WorkspacePage -> CommandInput` and `MainLayout -> SettingsPanel`.
- For OpenCode behavior, prefer reading the local `opencode-src` checkout before guessing protocol semantics. This repo already mirrors backend-specific flows like sessions, permissions, questions, commands, skills, and abort.
