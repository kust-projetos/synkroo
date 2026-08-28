# orca-async-dispatch.ps1 — cria task + dispara coder sem bloquear planner
param(
  [Parameter(Mandatory=$true)][string]$Spec,
  [string]$Agent = "opencode",
  [string]$Worktree = "current",
  [string]$Objective = ""
)
$ORCA = "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe"
if ($env:ORCA_CLI_COMMAND) { $ORCA = $env:ORCA_CLI_COMMAND }

# 1. Garantir Run
if ($Objective) {
  $runJson = & $ORCA orchestration run-create --objective $Objective --json 2>&1 | Out-String
  $runId = ($runJson | ConvertFrom-Json).result.id
  Write-Host "Run criado: $runId" -ForegroundColor Green
} else {
  $runs = (& $ORCA orchestration run-list --json 2>&1 | Out-String | ConvertFrom-Json).result.runs
  if (-not $runs -or $runs.Count -eq 0) {
    throw "Nenhum Run ativo — passe -Objective para criar um"
  }
  $runId = $runs[0].id
  Write-Host "Usando Run existente: $runId ($($runs[0].objective))" -ForegroundColor Yellow
}

# 2. Criar Task
$taskJson = & $ORCA orchestration task-create --spec $Spec --json 2>&1 | Out-String
$taskId = ($taskJson | ConvertFrom-Json).result.id
if (-not $taskId) { throw "Falha ao criar task: $taskJson" }
Write-Host "Task criada: $taskId" -ForegroundColor Cyan

# 3. Dispatch assíncrono
$dispatchJson = & $ORCA orchestration worker-start --task $taskId --worktree $Worktree --agent $Agent --json 2>&1 | Out-String
$receipt = $dispatchJson | ConvertFrom-Json
if ($receipt.ok -ne $true) { throw "worker-start falhou: $dispatchJson" }
$dispatchId = $receipt.result.dispatchId
$termHandle = $receipt.result.terminalHandle
Write-Host "Dispatched assíncrono — dispatch:$dispatchId terminal:$termHandle" -ForegroundColor Green
Write-Host "Planner livre — NÃO foi feito await. Coder notifica via worker_done." -ForegroundColor Magenta
return @{ runId=$runId; taskId=$taskId; dispatchId=$dispatchId; terminalHandle=$termHandle; receipt=$receipt }
