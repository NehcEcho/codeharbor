$ErrorActionPreference = "Stop"

$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("opencode:opencode-demo-4096"))
$headers = @{ Authorization = "Basic $auth" }

$sessionBody = @{ title = "stream inspection" } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4096/session" -Headers $headers -ContentType "application/json" -Body $sessionBody
$sessionId = $session.id

Write-Output "SESSION:$sessionId"

$eventJob = Start-Job -ScriptBlock {
  param($authHeader)

  $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:4096/event")
  $request.Headers.Add("Authorization", $authHeader)
  $request.Accept = "text/event-stream"
  $request.Timeout = 30000
  $request.ReadWriteTimeout = 30000

  $response = $request.GetResponse()
  $stream = $response.GetResponseStream()
  $reader = New-Object System.IO.StreamReader($stream)

  try {
    while (-not $reader.EndOfStream) {
      $line = $reader.ReadLine()
      if ($null -ne $line) {
        Write-Output $line
      }
    }
  } finally {
    $reader.Close()
    $stream.Close()
    $response.Close()
  }
} -ArgumentList "Basic $auth"

Start-Sleep -Seconds 2

$messageBody = @{
  agent = "build"
  parts = @(
    @{
      type = "text"
      text = "Reply with exactly STREAM_TEST_OK and nothing else."
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:4096/session/$sessionId/message" -Headers $headers -ContentType "application/json" -Body $messageBody | Out-Null

Start-Sleep -Seconds 8

Stop-Job $eventJob -ErrorAction SilentlyContinue | Out-Null
$output = Receive-Job $eventJob -Keep
Remove-Job $eventJob -Force | Out-Null

$output | Set-Content -Path "event-sample.log"
$output | Select-Object -First 200
