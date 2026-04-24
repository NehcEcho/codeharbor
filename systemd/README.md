# Systemd Setup

These unit files run CodeHarbor in production mode as `root` on this host.

## Services

- `opencode.service`: starts OpenCode on port `1656`
- `codeharbor.service`: serves the built web app on port `1657`

## Install

Copy the units into `systemd`:

```bash
sudo cp /root/codeharbor/systemd/opencode.service /etc/systemd/system/
sudo cp /root/codeharbor/systemd/codeharbor.service /etc/systemd/system/
```

Reload and enable them:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now opencode.service
sudo systemctl enable --now codeharbor.service
```

If you want a one-command stop helper, make it executable and run it:

```bash
chmod +x /root/codeharbor/systemd/stop-codeharbor.sh
/root/codeharbor/systemd/stop-codeharbor.sh
```

The script stops both services, with `codeharbor.service` first.

## Verify

```bash
systemctl status opencode.service
systemctl status codeharbor.service
journalctl -u opencode.service -n 100 --no-pager
journalctl -u codeharbor.service -n 100 --no-pager
```

## Stop

```bash
sudo systemctl stop codeharbor.service opencode.service
```

Or use the helper script above.

Open the UI at `http://127.0.0.1:1657`.

## Rebuild after frontend changes

`codeharbor.service` serves `dist/`, so rebuild after frontend changes:

```bash
cd /root/codeharbor
npm run build
sudo systemctl restart codeharbor.service
```

## Notes

- The included OpenCode password is the current project default. Change it before exposing the service beyond local development.
- If the `opencode` binary moves, update `ExecStart` in `opencode.service`.
- If the web server entrypoint moves, update `ExecStart` in `codeharbor.service`.
