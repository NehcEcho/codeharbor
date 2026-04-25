@echo off
setlocal

set "TASK_NAME=CodeHarbor"

echo [CodeHarbor] Removing Windows auto-start task...
schtasks /Delete /TN "%TASK_NAME%" /F
if errorlevel 1 (
  echo [CodeHarbor] Failed to remove the Task Scheduler entry, or it does not exist.
  pause
  exit /b 1
)

echo [CodeHarbor] Auto-start removed.
exit /b 0
