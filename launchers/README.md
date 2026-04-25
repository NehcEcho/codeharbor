# CodeHarbor Launchers

This folder contains one-click launcher scripts for Windows and Linux.

Top level only keeps two quick-entry files:

- `start.cmd`: Windows one-click start
- `enable-autostart.cmd`: Windows one-click login auto-start

Everything else is grouped by platform:

- `windows/`: Windows start, stop, restart, status, and auto-start helpers
- `linux/`: Linux start, stop, restart, status, and auto-start helpers

Windows in `launchers/windows`:

- `windows-start.cmd`: install dependencies if needed, then start the local stack
- `windows-stop.cmd`: stop the local stack
- `windows-restart.cmd`: restart the local stack
- `windows-status.cmd`: show local stack status
- `windows-autostart-enable.cmd`: enable start-on-login with Task Scheduler
- `windows-autostart-disable.cmd`: remove the start-on-login task
- `windows-autostart-status.cmd`: show whether the start-on-login task exists

Linux in `launchers/linux`:

- `start`: short entrypoint for manual start
- `enable-autostart`: short entrypoint for boot auto-start setup
- `linux-start.sh`: install dependencies if needed, then start the local stack in manual mode
- `linux-stop.sh`: stop the manual local stack
- `linux-restart.sh`: restart the manual local stack
- `linux-status.sh`: show whether the backend and web UI ports are reachable
- `linux-autostart-enable.sh`: install and enable systemd services at boot
- `linux-autostart-disable.sh`: disable and remove the systemd services
- `linux-autostart-status.sh`: show the current systemd service status

Linux auto-start notes:

- `linux-autostart-enable.sh` now generates systemd unit files from the current project path automatically
- it detects the current `node` and `opencode` executable locations
- it defaults the service user to `${SUDO_USER}` or `${USER}`
- you can override the service user with `CODEHARBOR_SERVICE_USER`

Default ports:

- OpenCode server: `1656`
- Web UI: `1657`

Default credentials:

- username: `opencode`
- password: `opencode-demo-4096`
