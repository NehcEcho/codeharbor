@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"

echo [CodeHarbor] Stopping local stack...
call npm run stack -- down
if errorlevel 1 (
  echo [CodeHarbor] Stop command failed.
  pause
  exit /b 1
)

echo [CodeHarbor] Local stack stopped.
exit /b 0
