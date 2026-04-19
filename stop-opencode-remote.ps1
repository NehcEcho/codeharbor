$ErrorActionPreference = "SilentlyContinue"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeFile = Join-Path $projectRoot ".opencode-remote-runtime.json"

function Stop-ManagedProcessTree {
  param([int] $ProcessId)

  if ($ProcessId -gt 0) {
    Start-Process taskkill.exe -ArgumentList @('/PID', $ProcessId, '/T', '/F') -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue | Out-Null
  }
}

if (-not (Test-Path $runtimeFile)) {
  $ports = @(4096, 5173)
  $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $pids) {
    Stop-ManagedProcessTree -ProcessId ([int]$processId)
  }
  Write-Host "OpenCode Remote runtime file was missing, but listening ports were cleaned up." -ForegroundColor Yellow
  exit 0
}

$runtime = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json

foreach ($processId in $runtime.processIds | Sort-Object -Descending) {
  Stop-ManagedProcessTree -ProcessId ([int]$processId)
}

if ($runtime.browserPath -and $runtime.browserProfileDir -and (Test-Path $runtime.browserPath)) {
  Start-Process $runtime.browserPath -ArgumentList @(
    "--user-data-dir=$($runtime.browserProfileDir)",
    "--close-window"
  ) -WindowStyle Hidden -ErrorAction SilentlyContinue | Out-Null
}

if ($runtime.browserProfileDir -and (Test-Path $runtime.browserProfileDir)) {
  Remove-Item $runtime.browserProfileDir -Recurse -Force -ErrorAction SilentlyContinue
}

Remove-Item $runtimeFile -Force -ErrorAction SilentlyContinue
Write-Host "OpenCode Remote has been stopped." -ForegroundColor Green
