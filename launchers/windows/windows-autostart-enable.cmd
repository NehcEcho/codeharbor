@echo off
setlocal

set "PROJECT_ROOT=%~dp0..\.."
set "TASK_NAME=CodeHarbor"
set "RUNNER=%PROJECT_ROOT%\scripts\run-windows.ps1"

if not exist "%RUNNER%" (
  echo [CodeHarbor] Runner script was not found: %RUNNER%
  pause
  exit /b 1
)

echo [CodeHarbor] Enabling Windows auto-start task...

schtasks /Create /TN "%TASK_NAME%" /SC ONLOGON /RL LIMITED /F /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%RUNNER%\" up --no-browser"
if errorlevel 1 (
  echo [CodeHarbor] Failed to create the Task Scheduler entry.
  pause
  exit /b 1
)

echo [CodeHarbor] Auto-start enabled.
echo [CodeHarbor] Task name: %TASK_NAME%
exit /b 0
