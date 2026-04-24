$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $projectRoot ".runtime"
$logsDir = Join-Path $runtimeDir "logs"
$runtimeFile = Join-Path $runtimeDir "local-stack.json"

$command = if ($args.Length -gt 0) { $args[0].ToLowerInvariant() } else { "up" }
$noBrowser = $args -contains "--no-browser"

$hostName = if ($env:HOST) { $env:HOST.Trim() } else { "127.0.0.1" }
$webPort = if ($env:CODEHARBOR_WEB_PORT) { [int]$env:CODEHARBOR_WEB_PORT } elseif ($env:PORT) { [int]$env:PORT } else { 1657 }
$serverPort = if ($env:OPENCODE_SERVER_PORT) { [int]$env:OPENCODE_SERVER_PORT } else { 1656 }
$serverUsername = if ($env:OPENCODE_SERVER_USERNAME) { $env:OPENCODE_SERVER_USERNAME.Trim() } else { "opencode" }
$serverPassword = if ($env:OPENCODE_SERVER_PASSWORD) { $env:OPENCODE_SERVER_PASSWORD.Trim() } else { "opencode-demo-4096" }

$serverUrl = "http://127.0.0.1:$serverPort"
$webUrl = "http://127.0.0.1:$webPort"

function Ensure-RuntimeDirs {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
}

function Write-LogHeader {
  param([string]$Path, [string]$Title)
  Set-Content -LiteralPath $Path -Value "[$([DateTime]::Now.ToString('s'))] $Title" -Encoding UTF8
}

function Read-RuntimeState {
  if (-not (Test-Path $runtimeFile)) { return $null }
  return Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
}

function Save-RuntimeState {
  param([hashtable]$State)
  Ensure-RuntimeDirs
  $State | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding UTF8
}

function Remove-RuntimeState {
  Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
}

function Stop-ProcessTree {
  param([int]$ProcessId)
  if ($ProcessId -gt 0) {
    Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", $ProcessId, "/T", "/F" -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue | Out-Null
  }
}

function Clear-Port {
  param([int]$Port)
  $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    if ($connection.OwningProcess) {
      Stop-ProcessTree -ProcessId ([int]$connection.OwningProcess)
    }
  }
}

function Wait-ForHttpOk {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 30,
    [hashtable]$Headers
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $Headers -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return
      }
    } catch {}
    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for $Url"
}

function Wait-ForPortListen {
  param(
    [int]$Port,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $listening = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    if ($listening) {
      return
    }
    Start-Sleep -Milliseconds 500
  }

  throw "Timed out waiting for port $Port to listen"
}

function Start-LoggedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [hashtable]$Environment,
    [string]$StdOutPath,
    [string]$StdErrPath
  )

  $setEnv = @()
  foreach ($entry in $Environment.GetEnumerator()) {
    $setEnv += "set `"$($entry.Key)=$($entry.Value)`""
  }

  $quotedFile = if ($FilePath.Contains(" ")) { '"' + $FilePath + '"' } else { $FilePath }
  $quotedArgs = $ArgumentList | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
  $segments = @("cd /d `"$WorkingDirectory`"") + $setEnv + @("$quotedFile $($quotedArgs -join ' ') 1>>`"$StdOutPath`" 2>>`"$StdErrPath`"")
  $commandLine = $segments -join " && "

  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/d", "/s", "/c", $commandLine -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru
  return [int]$proc.Id
}

function Show-Status {
  $serverUp = $false
  $webUp = $false
  try {
    $null = & curl.exe -fsS -u "${serverUsername}:${serverPassword}" --max-time 3 "$serverUrl/global/health"
    $serverUp = $true
  } catch {}

  try {
    $null = & curl.exe -fsS --max-time 3 "$webUrl/index.html"
    $webUp = $true
  } catch {}

  Write-Host "OpenCode: $serverUp ($serverUrl)"
  Write-Host "Web UI:   $webUp ($webUrl)"
  Write-Host "Logs:     $logsDir"
}

function Stop-Stack {
  $runtime = Read-RuntimeState
  if ($runtime) {
    if ($runtime.webPid) { Stop-ProcessTree -ProcessId ([int]$runtime.webPid) }
    if ($runtime.serverPid) { Stop-ProcessTree -ProcessId ([int]$runtime.serverPid) }
  }

  Clear-Port -Port $webPort
  Clear-Port -Port $serverPort
  Remove-RuntimeState
  Write-Host "CodeHarbor local stack stopped."
}

function Start-Stack {
  Ensure-RuntimeDirs
  Stop-Stack | Out-Null

  $serverLog = Join-Path $logsDir "opencode.log"
  $serverErr = Join-Path $logsDir "opencode.error.log"
  $buildLog = Join-Path $logsDir "build.log"
  $buildErr = Join-Path $logsDir "build.error.log"
  $webLog = Join-Path $logsDir "web.log"
  $webErr = Join-Path $logsDir "web.error.log"

  Write-LogHeader -Path $serverLog -Title "OpenCode stdout"
  Write-LogHeader -Path $serverErr -Title "OpenCode stderr"
  Write-LogHeader -Path $buildLog -Title "Build stdout"
  Write-LogHeader -Path $buildErr -Title "Build stderr"
  Write-LogHeader -Path $webLog -Title "Web stdout"
  Write-LogHeader -Path $webErr -Title "Web stderr"

  Write-Host "Starting OpenCode server..."
  $serverPid = Start-LoggedProcess -FilePath "opencode.cmd" -ArgumentList @("serve", "--hostname", $hostName, "--port", "$serverPort", "--print-logs", "--log-level", "DEBUG") -WorkingDirectory $projectRoot -Environment @{
    OPENCODE_SERVER_USERNAME = $serverUsername
    OPENCODE_SERVER_PASSWORD = $serverPassword
  } -StdOutPath $serverLog -StdErrPath $serverErr

  try {
    Wait-ForPortListen -Port $serverPort -TimeoutSeconds 30
  } catch {
    Stop-ProcessTree -ProcessId $serverPid
    throw "OpenCode failed to start.`n`n$(Get-Content -LiteralPath $serverErr -Raw)"
  }

  Write-Host "Building CodeHarbor..."
  $buildCommand = "cd /d `"$projectRoot`" && npm.cmd run build 1>>`"$buildLog`" 2>>`"$buildErr`""
  $build = Start-Process -FilePath "cmd.exe" -ArgumentList "/d", "/s", "/c", $buildCommand -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
  if ($build.ExitCode -ne 0) {
    Stop-ProcessTree -ProcessId $serverPid
    throw "Build failed.`n`n$(Get-Content -LiteralPath $buildErr -Raw)"
  }

  Write-Host "Starting production web server..."
  $webPid = Start-LoggedProcess -FilePath "node.exe" -ArgumentList @("scripts\server.mjs") -WorkingDirectory $projectRoot -Environment @{
    HOST = $hostName
    PORT = "$webPort"
  } -StdOutPath $webLog -StdErrPath $webErr

  try {
    Wait-ForPortListen -Port $webPort -TimeoutSeconds 30
  } catch {
    Stop-ProcessTree -ProcessId $webPid
    Stop-ProcessTree -ProcessId $serverPid
    throw "Web server failed to start.`n`n$(Get-Content -LiteralPath $webErr -Raw)"
  }

  Save-RuntimeState -State @{
    startedAt = [DateTime]::Now.ToString("s")
    serverUrl = $serverUrl
    webUrl = $webUrl
    serverPid = $serverPid
    webPid = $webPid
    logsDir = $logsDir
  }

  Write-Host "CodeHarbor is ready."
  Write-Host "Web UI:     $webUrl"
  Write-Host "Server URL: $serverUrl"
  Write-Host "Username:   $serverUsername"
  Write-Host "Password:   $serverPassword"
  Write-Host "Logs:       $logsDir"

  if (-not $noBrowser) {
    Start-Process $webUrl | Out-Null
  }
}

switch ($command) {
  "up" { Start-Stack }
  "down" { Stop-Stack }
  "restart" { Stop-Stack; Start-Stack }
  "status" { Show-Status }
  default {
    Write-Host "Usage: npm run stack -- <up|down|restart|status> [--no-browser]"
    exit 1
  }
}
