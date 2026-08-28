# orca-poll.ps1 — poll não-bloqueante de notificações planner
param(
  [int]$TimeoutMs = 15000,
  [switch]$Ack,
  [switch]$Release
)
$ORCA = "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe"
if ($env:ORCA_CLI_COMMAND) { $ORCA = $env:ORCA_CLI_COMMAND }

$raw = & $ORCA orchestration check --wait --types worker_done,escalation,question --timeout-ms $TimeoutMs --json 2>&1 | Out-String
$inbox = $raw | ConvertFrom-Json
if (-not $inbox.result) { Write-Host "Sem inbox result — raw: $raw"; return $inbox }

$count = $inbox.result.count
if ($count -eq 0 -or -not $inbox.result.messages -or $inbox.result.messages.Count -eq 0) {
  Write-Host "Nenhuma notificação nova (timeout ${TimeoutMs}ms) — planner segue livre." -ForegroundColor DarkGray
  return $inbox
}

Write-Host "Recebidas $($inbox.result.messages.Count) mensagem(ns) — delivery $($inbox.result.deliveryId)" -ForegroundColor Cyan
foreach ($m in $inbox.result.messages) {
  $icon = switch ($m.type) { "worker_done" { "✅" } "question" { "❓" } "escalation" { "🚨" } default { "📩" } }
  Write-Host "$icon [$($m.type)] $($m.subject) — outcome:$($m.outcome) task:$($m.taskId) dispatch:$($m.dispatchId)"
  Write-Host "   $($m.body)" -ForegroundColor Gray
  if ($Release -and $m.type -eq "worker_done" -and $m.dispatchId) {
    Write-Host "   → liberando terminal $($m.dispatchId)..." -ForegroundColor Yellow
    & $ORCA orchestration worker-release --dispatch $m.dispatchId --json | Out-Null
  }
}

if ($Ack -and $inbox.result.deliveryId) {
  Write-Host "Ack delivery $($inbox.result.deliveryId)..." -ForegroundColor DarkCyan
  & $ORCA orchestration check --ack $inbox.result.deliveryId --wait --types worker_done,escalation,question --timeout-ms $TimeoutMs --json | Out-Null
}
return $inbox
