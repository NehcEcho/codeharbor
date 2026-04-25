# Platform Startup Guide

This guide covers the current launcher-based workflow for running CodeHarbor on Windows and Linux, plus the manual fallback flow for macOS.

## Shared defaults

By default, CodeHarbor uses:

```text
OpenCode server: http://127.0.0.1:1656
Web UI:          http://127.0.0.1:1657
Username:        opencode
Password:        opencode-demo-4096
```

Required local tools:

- Node.js
- npm
- OpenCode CLI (`opencode`)

Install dependencies first if you want to run commands directly:

```bash
npm install
```

Build the frontend when you change UI code:

```bash
npm run build
```

## Windows

### Recommended launcher flow

Use the top-level launcher files in `launchers/`.

Start everything:

```powershell
launchers\start.cmd
```

Enable login auto-start:

```powershell
launchers\enable-autostart.cmd
```

Other Windows helpers live in `launchers/windows/`:

- `launchers/windows/windows-stop.cmd`
- `launchers/windows/windows-restart.cmd`
- `launchers/windows/windows-status.cmd`
- `launchers/windows/windows-autostart-disable.cmd`
- `launchers/windows/windows-autostart-status.cmd`

The Windows launcher will:

- check for `npm`
- check for `opencode`
- run `npm install` if `node_modules/` is missing
- call the built-in stack runner

Logs and runtime state are written to:

- `.runtime/local-stack.json`
- `.runtime/logs/`

### Notes

- `launchers\enable-autostart.cmd` creates a Windows Task Scheduler entry named `CodeHarbor`
- the task runs `scripts/run-windows.ps1 up --no-browser` at login
- if you prefer direct control, the underlying runner still supports `npm run stack -- up|down|restart|status`

## Linux

### Recommended launcher flow

Use the Linux launchers in `launchers/linux/`.

Give the scripts execute permission once:

```bash
chmod +x launchers/linux/* launchers/linux/*.sh
```

Start manually:

```bash
./launchers/linux/start
```

Enable boot auto-start:

```bash
./launchers/linux/enable-autostart
```

Other Linux helpers live in `launchers/linux/`:

- `launchers/linux/linux-stop.sh`
- `launchers/linux/linux-restart.sh`
- `launchers/linux/linux-status.sh`
- `launchers/linux/linux-autostart-disable.sh`
- `launchers/linux/linux-autostart-status.sh`

This starts:

- `opencode serve --hostname 0.0.0.0 --port 1656`
- `npm run start` with `HOST=0.0.0.0 PORT=1657`

### Enable auto-start on boot with systemd

The recommended way is now:

```bash
./launchers/linux/enable-autostart
```

That launcher:

- checks for `npm`, `node`, `opencode`, and `systemctl`
- installs dependencies if needed
- runs `npm run build`
- generates `/etc/systemd/system/opencode.service`
- generates `/etc/systemd/system/codeharbor.service`
- enables and starts both services

Check status:

```bash
./launchers/linux/linux-autostart-status.sh
```

Stop both:

```bash
./launchers/linux/linux-autostart-disable.sh
```

Rebuild and restart after frontend changes:

```bash
npm run build
sudo systemctl restart codeharbor.service
```

### Notes about the included Linux services

The launcher-generated services use your current environment instead of the checked-in fixed paths.

- project path is detected from the current checkout
- `node` and `opencode` paths are detected automatically
- service user defaults to `CODEHARBOR_SERVICE_USER`, otherwise `SUDO_USER` or `USER`
- the checked-in files under `systemd/` are still useful as examples, but they are no longer the preferred entrypoint for local setup

## macOS

### Start manually

CodeHarbor does not currently include a macOS-specific launcher script, so use two terminals or a background runner.

Start OpenCode:

```bash
OPENCODE_SERVER_USERNAME=opencode OPENCODE_SERVER_PASSWORD=opencode-demo-4096 opencode serve --hostname 127.0.0.1 --port 1656
```

In the project directory, build and start CodeHarbor:

```bash
npm run build
HOST=127.0.0.1 PORT=1657 npm run start
```

If you only want the frontend development server instead of the production server:

```bash
npm run dev -- --host 127.0.0.1 --port 1657
```

### Enable auto-start after login with launchd

On macOS, use LaunchAgents for per-user auto-start after login.

1. Create `~/Library/LaunchAgents/com.codeharbor.opencode.plist`
2. Create `~/Library/LaunchAgents/com.codeharbor.web.plist`
3. Replace `/Users/yourname/codeharbor` with your real project path

Example OpenCode LaunchAgent:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.codeharbor.opencode</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-lc</string>
    <string>export OPENCODE_SERVER_USERNAME=opencode; export OPENCODE_SERVER_PASSWORD=opencode-demo-4096; opencode serve --hostname 127.0.0.1 --port 1656</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>/Users/yourname/codeharbor</string>
  <key>StandardOutPath</key>
  <string>/tmp/codeharbor-opencode.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/codeharbor-opencode.error.log</string>
</dict>
</plist>
```

Example CodeHarbor LaunchAgent:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.codeharbor.web</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-lc</string>
    <string>cd /Users/yourname/codeharbor &amp;&amp; npm run build &amp;&amp; HOST=127.0.0.1 PORT=1657 npm run start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>/Users/yourname/codeharbor</string>
  <key>StandardOutPath</key>
  <string>/tmp/codeharbor-web.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/codeharbor-web.error.log</string>
</dict>
</plist>
```

Load them:

```bash
launchctl load ~/Library/LaunchAgents/com.codeharbor.opencode.plist
launchctl load ~/Library/LaunchAgents/com.codeharbor.web.plist
```

Restart them after edits:

```bash
launchctl unload ~/Library/LaunchAgents/com.codeharbor.opencode.plist
launchctl unload ~/Library/LaunchAgents/com.codeharbor.web.plist
launchctl load ~/Library/LaunchAgents/com.codeharbor.opencode.plist
launchctl load ~/Library/LaunchAgents/com.codeharbor.web.plist
```

## Docker option

If you prefer Docker for the web UI, see `docs/deployment.md`.

Remember that the Compose stack does not bundle OpenCode itself. You still need a reachable OpenCode server.
