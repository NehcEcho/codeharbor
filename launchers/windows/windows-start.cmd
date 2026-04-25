@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."
cd /d "%PROJECT_ROOT%"

echo [CodeHarbor] Starting local stack...

where npm >nul 2>nul
if errorlevel 1 (
  echo [CodeHarbor] npm was not found. Please install Node.js first.
  pause
  exit /b 1
)

where opencode >nul 2>nul
if errorlevel 1 (
  echo [CodeHarbor] opencode was not found. Please install the OpenCode CLI first.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [CodeHarbor] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [CodeHarbor] Dependency installation failed.
    pause
    exit /b 1
  )
)

call npm run stack -- up %*
if errorlevel 1 (
  echo.
  echo [CodeHarbor] Startup failed. Check .runtime\logs for details.
  pause
  exit /b 1
)

echo.
echo [CodeHarbor] Startup command completed.
exit /b 0
