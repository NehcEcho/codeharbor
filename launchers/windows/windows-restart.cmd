@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"

echo [CodeHarbor] Restarting local stack...
set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=stack"

if /I "%TARGET%"=="stack" (
  call npm run stack -- restart
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
    "Set-Location '%PROJECT_ROOT%'; if (-not (Test-Path 'node_modules')) { npm.cmd install; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }; if ('%TARGET%' -eq 'opencode') { taskkill /F /IM opencode.cmd /T *> $null; Start-Process cmd.exe -ArgumentList '/d','/s','/c','cd /d \"%PROJECT_ROOT%\" && opencode.cmd serve --hostname 0.0.0.0 --port 1656' -WindowStyle Hidden } elseif ('%TARGET%' -eq 'web') { taskkill /F /FI 'WINDOWTITLE eq scripts/server.mjs' *> $null; npm.cmd run build; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; Start-Process node.exe -ArgumentList 'scripts/server.mjs' -WorkingDirectory '%PROJECT_ROOT%' -WindowStyle Hidden } else { exit 1 }"
)

if errorlevel 1 (
  echo.
  echo [CodeHarbor] Restart failed. Check .runtime\logs for details.
  pause
  exit /b 1
)

echo [CodeHarbor] Local stack restarted.
exit /b 0
