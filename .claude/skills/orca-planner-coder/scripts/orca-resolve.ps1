# orca-resolve.ps1 — resolve $ORCA e valida runtime
param([switch]$Json)
$ORCA = "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe"
if ($env:ORCA_CLI_COMMAND) { $ORCA = $env:ORCA_CLI_COMMAND }
elseif ($env:ORCA_DEV_REPO_ROOT) { $ORCA = "orca-dev" }
Write-Host "ORCA=$ORCA" -ForegroundColor Cyan
$status = & $ORCA status --json 2>&1 | Out-String
try { $j = $status | ConvertFrom-Json; $running = $j.result.runtime.reachable } catch { $running = $false }
if (-not $running) {
  Write-Warning "Runtime não alcançável — tentando abrir..."
  & $ORCA open --json | Out-Null; Start-Sleep 3
  $status = & $ORCA status --json 2>&1 | Out-String
}
if ($Json) { $status } else { $status | ConvertFrom-Json | ConvertTo-Json -Depth 8 }
