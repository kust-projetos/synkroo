# orca-planner-coder — Referência Completa

## Resolução do CLI (Windows — PowerShell)

```powershell
$ORCA="C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe"
if ($env:ORCA_CLI_COMMAND) { $ORCA=$env:ORCA_CLI_COMMAND }
elseif ($env:ORCA_DEV_REPO_ROOT) { $ORCA="orca-dev" }
# Verificar
& $ORCA status --json
if (-not $?) { & $ORCA open --json; Start-Sleep 3; & $ORCA status --json }
```

Nunca crie variável `ORCA` literal — substitua no comando. Todos os exemplos abaixo usam `$ORCA`.

## Anatomia Run / Task / Dispatch

- **Run** = namespace + inbox do coordenador. 1 por wave. Criado pelo planner.
- **Task** = item de trabalho (spec). 1 por entrega do coder.
- **Dispatch** = tentativa de execução de uma Task em um terminal. Criado por `worker-start`.

## Padrão assíncrono detalhado

### Planner — ciclo completo

```powershell
# 1. Criar ou reusar Run
$run = (& $ORCA orchestration run-create --objective "Synkroo Wave 5 — F5.03" --json | ConvertFrom-Json).result.id
# ou listar existente: & $ORCA orchestration run-list --json

# 2. Criar tasks independentes ANTES de despachar (permite wave paralela)
$taskA = (& $ORCA orchestration task-create --spec "CODER: F5.03 timezone fix em src/services/appointments/* | TDD src/modules/operacional/__tests__/timezone.test.ts | Validar npm test + tsc" --json | ConvertFrom-Json).result.id
$taskB = (& $ORCA orchestration task-create --spec "CODER: docs sync AGENTS.md por análise src/app/api 36 módulos | Validar roadmap:check" --json | ConvertFrom-Json).result.id

# 3. Despachar sem await — dispara e segue
$receiptA = & $ORCA orchestration worker-start --task $taskA --worktree current --agent opencode --json | ConvertFrom-Json
$receiptB = & $ORCA orchestration worker-start --task $taskB --worktree current --agent opencode --json | ConvertFrom-Json
# receipt contém dispatchId, terminal handle, stage=ready

# 4. Planner continua: planeja próxima wave, revisa, responde perguntas
# NÃO fazer check --wait 900000 aqui — isso é o anti-padrão bloqueante

# 5. Poll não-bloqueante quando conveniente (ex: a cada 30s ou ao receber notificação visual)
$inbox = & $ORCA orchestration check --wait --types worker_done,escalation,question --timeout-ms 15000 --json | ConvertFrom-Json
# Se count==0 → nada novo, continue trabalhando
# Se worker_done → processar, liberar, ack

foreach ($msg in $inbox.result.messages) {
  if ($msg.type -eq "worker_done") {
    Write-Host "Coder terminou: $($msg.subject) outcome=$($msg.outcome)"
    # Validar entrega: lint, tsc, testes — antes de aceitar
    & $ORCA orchestration worker-release --dispatch $msg.dispatchId --json
  }
  elseif ($msg.type -eq "question") {
    & $ORCA orchestration reply --id $msg.id --body "Resposta do planner" --json
  }
  elseif ($msg.type -eq "escalation") {
    Write-Host "ESCALATION: $($msg.body)" -ForegroundColor Red
  }
}
# Ack APÓS processar tudo
if ($inbox.result.deliveryId) {
  & $ORCA orchestration check --ack $inbox.result.deliveryId --wait --types worker_done,escalation,question --timeout-ms 15000 --json | Out-Null
}
```

### Coder — obrigações do terminal trabalhador

Toda task injetada via `worker-start --inject` inclui preamble com `taskId`/`dispatchId` e instruções de lifecycle. O coder deve:

```powershell
# Durante trabalho longo (15min+): enviar heartbeat se preamble pedir
& $ORCA orchestration send --type heartbeat --subject "alive" --payload '{"taskId":"<task_id>","dispatchId":"<dispatch_id>","phase":"implementing"}' --json

# Se bloqueado — pedir ao planner (não adivinhar)
& $ORCA orchestration ask --question "Como tratar clinicId faltante em X?" --options "fail-closed,fallback" --timeout-ms 600000 --json
# Fica bloqueado até planner responder via reply

# Ao terminar — SEMPRE worker_done com outcome explícito
& $ORCA orchestration send --type worker_done --subject "F5.03 pronto — lint/tsc/tests ok" --body "Implementei timezone fix em appointments/service.ts + 3 novos testes RED→GREEN. Falta: e2e. Arquivos: src/services/appointments/service.ts" --task-id <task_id> --dispatch-id <dispatch_id> --outcome succeeded --files-modified "src/services/appointments/service.ts,src/modules/operacional/__tests__/timezone.test.ts" --json

# Em falha:
& $ORCA orchestration send --type worker_done --subject "F5.03 failed — 2 testes vermelhos" --body "Falha em timezone.test.ts linha 42: expected 200 got 500. Tentei Y, não resolveu. Precisa decisão planner." --task-id <task_id> --dispatch-id <dispatch_id> --outcome failed --json

# Depois de worker_done: ficar idle no prompt — NÃO fechar terminal, NÃO iniciar outra tarefa por conta própria
```

### Alternativa low-level (quando worker-start não expressa topologia)

```powershell
# Criar terminal bare + dispatch com inject manual
& $ORCA terminal create --worktree active --title "coder-F5.03" --command "opencode" --json
& $ORCA terminal wait --terminal <handle> --for tui-idle --timeout-ms 60000 --json
& $ORCA orchestration dispatch --task <task_id> --to <handle> --inject --json
```

Use apenas se precisar de `command` custom (ex: `antigravity --model X`).

## Tipos de mensagem

| Tipo | Direção | Uso |
|------|---------|-----|
| `worker_done` | coder → planner | Entrega final, com outcome + files-modified. Marca task/dispatch como completed/failed automaticamente. |
| `question` | coder → planner | Bloqueante via `ask` — coder espera `reply`. |
| `escalation` | coder → planner | Requer intervenção (planner decide). |
| `heartbeat` | coder → planner | Sinal vivo (fase: implementing/testing). Só se preamble pedir. |
| `status` | coder → all | Broadcast progresso (não lifecycle). |
| `dispatch` | planner → coder | Guidance para dispatch específico (`--to dispatch:<id>`). |

## Gates e decisão

Para decisões do planner que bloqueiam DAG:

```powershell
& $ORCA orchestration gate-create --task <task_id> --question "Aprovar PR coder?" --options '["aprovar","ajustar","rejeitar"]' --json
& $ORCA orchestration gate-resolve --id <gate_id> --resolution "aprovar" --json
```

Use `gate-*` para decisões do coordenador; use `ask`/`reply` para perguntas do worker.

## Verificação de estado (sem mutação)

```powershell
& $ORCA orchestration task-list --json                  # todas tasks do Run bound
& $ORCA orchestration task-list --ready --json          # prontas para dispatch
& $ORCA orchestration task-list --brief --json          # sweep rápido
& $ORCA orchestration dispatch-show --task <task_id> --json
& $ORCA orchestration inbox --json                      # inbox bruto
& $ORCA orchestration check --peek --format --json      # unread formatado sem consumir
& $ORCA terminal list --json
& $ORCA terminal read --terminal <handle> --json
& $ORCA orchestration worker-show --dispatch <dispatch_id> --json
& $ORCA orchestration worker-read --dispatch <dispatch_id> --limit 50 --json
```

## Tratamento de falhas

- **Timeout de poll** (`count:0`): checkpoint, não falha. Continue esperando com rolling waits.
- **worker_show ready**: ainda trabalhando — veja `heartbeat` ou `terminal read`.
- **failed/stopped**: `worker-start --task <task> --retry-of <dispatch_id> --worktree current --agent opencode --json` (requer placement explícito).
- **outcome_unknown**: `worker-stop --dispatch <id>` ou `worker-abandon --dispatch <id>` (abandon não mata processo).
- **Após 3 falhas na mesma task**: circuit-breaker marca task como `failed` — planner deve criar nova task revisada.

## liberação de terminal

Após cada `worker_done` aceito:

```powershell
# Reuso imediato (mesmo agente, próxima task):
& $ORCA orchestration worker-start --task <next_task_id> --terminal <handle-do-worker-show> --json
# Caso contrário, liberar:
& $ORCA orchestration worker-release --dispatch <dispatch_id> --json
# Manter vivo para debug (exceção solicitada):
& $ORCA orchestration worker-retain --dispatch <dispatch_id> --json
```

Nunca libere por `timeout`, `heartbeat`, `question` ou `worker_done` rejeitado.

## Exemplo Synkroo real

```powershell
$ORCA="C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe"
$run = (& $ORCA orchestration run-create --objective "Synkroo Wave — planner opencode + coder antigravity" --json | ConvertFrom-Json).result.id
$task = (& $ORCA orchestration task-create --spec "CODER: implementar assertClinicScope em src/modules/comercial/actions/* | TDD src/modules/comercial/__tests__/comercial-actions-tenancy.test.ts | Validar npm test + tsc --noEmit + lint" --json | ConvertFrom-Json).result.id
& $ORCA orchestration worker-start --task $task --worktree current --agent opencode --json
# Planner livre — revisa outro PR, planeja próxima wave
# ...
# Poll quando quiser:
& $ORCA orchestration check --wait --types worker_done,escalation,question --timeout-ms 20000 --json
```

## Segurança

- Toda comunicação é local ao workspace `D:/projetos/synkroo` — não vaza para outros projetos.
- `worker_done` exige `taskId`+`dispatchId` válidos do preamble — não forje.
- Não despache com `dispatch --inject` para handoff total — use `worktree create --agent` nesse caso.
