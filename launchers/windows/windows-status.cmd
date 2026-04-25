@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"

call npm run stack -- status
if errorlevel 1 (
  echo [CodeHarbor] Status command failed.
  pause
  exit /b 1
)

exit /b 0
