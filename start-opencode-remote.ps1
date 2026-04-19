$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

# Editable startup settings
$serverUsername = "opencode"
$serverPassword = "opencode-demo-4096"
$serverPort = 4096
$webPort = 5173
$serverUrl = "http://127.0.0.1:$serverPort"
$webUrl = "http://127.0.0.1:$webPort"
$runtimeFile = Join-Path $projectRoot ".opencode-remote-runtime.json"

function Get-BrowserPath {
  $candidates = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Wait-ForHttpOk {
  param(
    [Parameter(Mandatory = $true)] [string] $Url,
    [int] $TimeoutSeconds = 30,
    [hashtable] $Headers
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Headers $Headers
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Timed out waiting for $Url"
}

function Start-ManagedProcess {
  param(
    [Parameter(Mandatory = $true)] [string] $FilePath,
    [Parameter(Mandatory = $true)] [string] $Arguments,
    [Parameter(Mandatory = $true)] [string] $WorkingDirectory,
    [string] $WindowStyle = "Minimized"
  )

  return Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle $WindowStyle
}

function Stop-AppPorts {
  $ports = @($serverPort, $webPort)
  $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }
  $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $pids) {
    if ($processId -and $processId -ne $PID) {
      Start-Process taskkill.exe -ArgumentList @('/PID', $processId, '/T', '/F') -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue | Out-Null
    }
  }
}

function Save-RuntimeState {
  param(
    [Parameter(Mandatory = $true)] [AllowEmptyCollection()] [System.Diagnostics.Process[]] $Processes,
    [string] $BrowserPath,
    [string] $BrowserProfileDir
  )

  $payload = [ordered]@{
    serverUrl = $serverUrl
    webUrl = $webUrl
    username = $serverUsername
    password = $serverPassword
    browserPath = $BrowserPath
    browserProfileDir = $BrowserProfileDir
    processIds = @($Processes | ForEach-Object { $_.Id })
  }

  $payload | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding UTF8
}

function Start-OpenCodeServer {
  param(
    [Parameter(Mandatory = $true)] [string] $WorkingDirectory,
    [Parameter(Mandatory = $true)] [string] $Username,
    [Parameter(Mandatory = $true)] [string] $Password,
    [Parameter(Mandatory = $true)] [int] $Port
  )

  $command = @"
`$env:OPENCODE_SERVER_USERNAME = '$Username'
`$env:OPENCODE_SERVER_PASSWORD = '$Password'
Set-Location '$($WorkingDirectory.Replace("'", "''"))'
opencode serve --hostname 0.0.0.0 --port $Port
"@

  return Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command", $command
  ) -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Minimized
}

function Start-CleanupWatcher {
  param(
    [Parameter(Mandatory = $true)] [int] $ParentPid,
    [Parameter(Mandatory = $true)] [int[]] $ChildPids,
    [Parameter(Mandatory = $true)] [string] $ProfileDir
  )

  $pidList = ($ChildPids | Where-Object { $_ -gt 0 }) -join ","
  $escapedProfileDir = $ProfileDir.Replace("'", "''")
  $escapedRuntimeFile = $runtimeFile.Replace("'", "''")
  $script = @"
`$parentPid = $ParentPid
`$childPids = @($pidList)
`$profileDir = '$escapedProfileDir'
`$runtimeFile = '$escapedRuntimeFile'
while (`$true) {
  Start-Sleep -Milliseconds 750
  if (-not (Get-Process -Id `$parentPid -ErrorAction SilentlyContinue)) {
    foreach (`$pid in `$childPids) {
      if (`$pid) {
        Start-Process taskkill.exe -ArgumentList @('/PID', `$pid, '/T', '/F') -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue | Out-Null
      }
    }
    if (Test-Path `$profileDir) {
      Remove-Item `$profileDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path `$runtimeFile) {
      Remove-Item `$runtimeFile -Force -ErrorAction SilentlyContinue
    }
    break
  }
}
"@

  Start-Process powershell -ArgumentList @(
    "-NoProfile",
    "-WindowStyle", "Hidden",
    "-Command", $script
  ) -WindowStyle Hidden | Out-Null
}

$browserProfileDir = Join-Path $env:TEMP "opencode-remote-browser"
if (Test-Path $browserProfileDir) {
  Remove-Item $browserProfileDir -Recurse -Force -ErrorAction SilentlyContinue
}

if (Test-Path $runtimeFile) {
  Remove-Item $runtimeFile -Force -ErrorAction SilentlyContinue
}

function Stop-ManagedProcessTree {
  param([int] $ProcessId)

  if ($ProcessId -gt 0) {
    Start-Process taskkill.exe -ArgumentList @('/PID', $ProcessId, '/T', '/F') -WindowStyle Hidden -Wait -ErrorAction SilentlyContinue | Out-Null
  }
}

$browserPath = Get-BrowserPath
$authBytes = [System.Text.Encoding]::ASCII.GetBytes("${serverUsername}:${serverPassword}")
$basicAuth = [Convert]::ToBase64String($authBytes)

$processes = @()

try {
  Stop-AppPorts

  Save-RuntimeState -Processes @() -BrowserPath $browserPath -BrowserProfileDir $browserProfileDir

  Write-Host "Starting OpenCode server..." -ForegroundColor Cyan
  $serverProcess = Start-OpenCodeServer -WorkingDirectory $projectRoot -Username $serverUsername -Password $serverPassword -Port $serverPort
  $processes += $serverProcess
  Save-RuntimeState -Processes $processes -BrowserPath $browserPath -BrowserProfileDir $browserProfileDir

  Write-Host "Waiting for OpenCode server on $serverUrl ..." -ForegroundColor DarkGray
  Wait-ForHttpOk -Url "$serverUrl/global/health" -Headers @{ Authorization = "Basic $basicAuth" } | Out-Null

  Write-Host "Starting web app..." -ForegroundColor Cyan
  $webProcess = Start-ManagedProcess -FilePath "cmd.exe" -Arguments "/c npm run dev -- --host 0.0.0.0 --port $webPort" -WorkingDirectory $projectRoot
  $processes += $webProcess
  Save-RuntimeState -Processes $processes -BrowserPath $browserPath -BrowserProfileDir $browserProfileDir

  Write-Host "Waiting for web UI on $webUrl ..." -ForegroundColor DarkGray
  Wait-ForHttpOk -Url $webUrl | Out-Null

  $browserProcess = $null
  if ($browserPath) {
    Write-Host "Launching browser..." -ForegroundColor Cyan
    $browserArgs = @(
      "--new-window",
      "--user-data-dir=$browserProfileDir",
      "--app=$webUrl"
    )
    $browserProcess = Start-Process -FilePath $browserPath -ArgumentList $browserArgs -PassThru -WindowStyle Normal
    $processes += $browserProcess
    Save-RuntimeState -Processes $processes -BrowserPath $browserPath -BrowserProfileDir $browserProfileDir
  } else {
    Write-Warning "Edge/Chrome not found. Opening the default browser instead, but it may not auto-close with this script."
    Start-Process $webUrl | Out-Null
  }

  Start-CleanupWatcher -ParentPid $PID -ChildPids ($processes | ForEach-Object { $_.Id }) -ProfileDir $browserProfileDir

  Write-Host ""
  Write-Host "OpenCode Remote is ready." -ForegroundColor Green
  Write-Host "Web UI:      $webUrl"
  Write-Host "Server URL:  $serverUrl"
  Write-Host "Username:    $serverUsername"
  Write-Host "Password:    $serverPassword"
  Write-Host ""
  Write-Host "Keep this window open while using the app." -ForegroundColor Yellow
  Write-Host "Close this window or press Enter to stop the web app, OpenCode server, and launched browser." -ForegroundColor Yellow
  [void](Read-Host)
}
finally {
  foreach ($process in $processes | Sort-Object Id -Descending) {
    if ($null -ne $process) {
      Stop-ManagedProcessTree -ProcessId $process.Id
    }
  }

  if (Test-Path $browserProfileDir) {
    Remove-Item $browserProfileDir -Recurse -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path $runtimeFile) {
    Remove-Item $runtimeFile -Force -ErrorAction SilentlyContinue
  }
}
