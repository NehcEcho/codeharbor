$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$startScript = Join-Path $projectRoot "start-opencode-remote.ps1"
$stopScript = Join-Path $projectRoot "stop-opencode-remote.ps1"
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("opencode:opencode-demo-4096"))

$proc = Start-Process powershell -ArgumentList @(
  "-ExecutionPolicy",
  "Bypass",
  "-NoProfile",
  "-File",
  $startScript
) -PassThru

try {
  $deadline = (Get-Date).AddSeconds(35)
  $web = $null
  $server = $null

  while ((Get-Date) -lt $deadline -and ($null -eq $web -or $null -eq $server)) {
    try {
      if ($null -eq $web) {
        $web = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:5173"
      }
    } catch {}

    try {
      if ($null -eq $server) {
        $server = Invoke-WebRequest -UseBasicParsing -Headers @{ Authorization = "Basic $auth" } "http://127.0.0.1:4096/global/health"
      }
    } catch {}

    if ($null -eq $web -or $null -eq $server) {
      Start-Sleep -Milliseconds 750
    }
  }

  if ($null -eq $web -or $null -eq $server) {
    throw "Startup failed"
  }

  Write-Output "WEB:$($web.StatusCode)"
  Write-Output "SERVER:$($server.StatusCode)"

  & $stopScript
  Start-Sleep -Seconds 4

  $webUp = $false
  $serverUp = $false

  try {
    Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:5173" | Out-Null
    $webUp = $true
  } catch {}

  try {
    Invoke-WebRequest -UseBasicParsing -Headers @{ Authorization = "Basic $auth" } "http://127.0.0.1:4096/global/health" | Out-Null
    $serverUp = $true
  } catch {}

  Write-Output "WEB_AFTER:$webUp"
  Write-Output "SERVER_AFTER:$serverUp"
}
finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
