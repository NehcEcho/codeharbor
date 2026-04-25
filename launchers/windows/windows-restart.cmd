@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"

echo [CodeHarbor] Restarting local stack...
call npm run stack -- restart %*
if errorlevel 1 (
  echo.
  echo [CodeHarbor] Restart failed. Check .runtime\logs for details.
  pause
  exit /b 1
)

echo [CodeHarbor] Local stack restarted.
exit /b 0
