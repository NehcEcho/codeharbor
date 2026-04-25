@echo off
setlocal

set "TASK_NAME=CodeHarbor"

echo [CodeHarbor] Checking Windows auto-start task...
schtasks /Query /TN "%TASK_NAME%"
if errorlevel 1 (
  echo [CodeHarbor] Auto-start task not found.
  exit /b 1
)

exit /b 0
