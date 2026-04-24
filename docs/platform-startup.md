# Platform Startup Guide

This guide covers how to run CodeHarbor on Windows, Linux, and macOS, including optional auto-start setup after login or boot.

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

Install dependencies first:

```bash
npm install
```

Build the frontend when you change UI code:

```bash
npm run build
```

## Windows

### Start manually

CodeHarbor includes a Windows stack runner.

Start everything:

```powershell
npm run stack -- up
```

Start without opening the browser:

```powershell
npm run stack -- up --no-browser
```

Check status:

```powershell
npm run stack -- status
```

Stop:

```powershell
npm run stack -- down
```

Logs and runtime state are written to:

- `.runtime/local-stack.json`
- `.runtime/logs/`

### Enable auto-start after login with Task Scheduler

The simplest reliable Windows auto-start method is Task Scheduler.

1. Open `Task Scheduler`
2. Create a new task, for example `CodeHarbor`
3. On `Triggers`, add `At log on`
4. On `Actions`, add:
   - `Program/script`:

     ```text
     powershell.exe
     ```

   - `Add arguments`:

     ```text
     -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\codeharbor\scripts\run-windows.ps1" up --no-browser
     ```

   - `Start in`:

     ```text
     C:\path\to\codeharbor
     ```

5. Save the task

If you prefer `schtasks`, adjust the path and run:

```powershell
schtasks /Create /TN "CodeHarbor" /SC ONLOGON /RL LIMITED /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"C:\path\to\codeharbor\scripts\run-windows.ps1\" up --no-browser"
```

To remove it later:

```powershell
schtasks /Delete /TN "CodeHarbor" /F
```

## Linux

### Start manually

For local manual background startup without `systemd`:

```bash
chmod +x docs/deployment/start-manual.sh
./docs/deployment/start-manual.sh
```

Stop it:

```bash
chmod +x docs/deployment/stop-manual.sh
./docs/deployment/stop-manual.sh
```

This starts:

- `opencode serve --hostname 0.0.0.0 --port 1656`
- `npm run start` with `HOST=0.0.0.0 PORT=1657`

### Enable auto-start on boot with systemd

This repo already includes `systemd` unit files:

- `systemd/opencode.service`
- `systemd/codeharbor.service`

Install and enable them:

```bash
chmod +x docs/deployment/start-systemd.sh
./docs/deployment/start-systemd.sh
```

That script copies the service files into `/etc/systemd/system/`, reloads `systemd`, and enables both services at boot.

Check status:

```bash
systemctl status opencode.service
systemctl status codeharbor.service
```

Stop both:

```bash
chmod +x docs/deployment/stop-systemd.sh
./docs/deployment/stop-systemd.sh
```

Rebuild and restart after frontend changes:

```bash
chmod +x docs/deployment/restart-systemd.sh
./docs/deployment/restart-systemd.sh
```

### Notes about the included Linux services

The checked-in service files currently assume:

- project path: `/root/codeharbor`
- Node path: `/usr/local/bin/node`
- OpenCode path: `/root/.opencode/bin/opencode`
- service user: `root`

If your machine uses different paths or a non-root user, edit:

- `systemd/opencode.service`
- `systemd/codeharbor.service`

before running the install helper.

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
