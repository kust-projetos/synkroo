---
name: orca-planner-coder
description: Orquestração Orca planner+coder assíncrona com notificação sem await. Use quando precisar conectar terminais do projeto via Orca, orquestrar 1 planner (estrategista/coordenador/supervisor) + 1 coder (operacional pesado), configurar dispatch não-bloqueante onde planner não espera coder, ou quando o coder deve notificar o planner via worker_done ao terminar.
---

# Orca Planner+Coder — Orquestração Assíncrona

## Quick start

```powershell
# 1. Resolver CLI (sempre primeiro)
& "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe" status --json

# 2. Planner inicia Run + Tasks (no terminal atual)
& "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe" orchestration run-create --objective "Synkroo Wave X — planner opencode + coder antigravity" --json
& "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe" orchestration task-create --spec "CODER: implementar feature Y com TDD em src/modules/..." --json

# 3. Planner dispara coder sem await (não-bloqueante)
& "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe" orchestration worker-start --task <task_id> --worktree current --agent opencode --json
# Planner segue livre — NÃO faz check --wait bloqueante aqui

# 4. Coder (terminal trabalhador) ao terminar notifica planner
& "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe" orchestration send --type worker_done --subject "Feature Y pronto" --body "O que fiz, onde, o que falta" --task-id <task_id> --dispatch-id <dispatch_id> --outcome succeeded --files-modified "src/..." --json

# 5. Planner verifica notificações quando quiser (poll leve, não bloqueante)
& "C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe" orchestration check --wait --types worker_done,escalation,question --timeout-ms 10000 --json
```

## Papéis

| Papel | Agente | Responsabilidade |
|-------|--------|------------------|
| **Planner** | `opencode` (terminal atual) | Estrategista, coordenador, supervisor. Decompõe wave, cria Run/Tasks, despacha, revisa PR, valida `verify`, gerencia gates. **Nunca** faz trabalho operacional pesado. |
| **Coder** | `antigravity` / `codex` / `opencode` (terminal 2 no mesmo worktree) | Operacional pesado: TDD RED→GREEN→REFACTOR, implementação, `tdd`, `lint`, `typecheck`, correção. Notifica planner via `worker_done`. |

Ver detalhes em [REFERENCE.md](REFERENCE.md).

## Workflow — 4 passos obrigatórios

### Passo 1: Resolver CLI + validar runtime

```powershell
$ORCA="C:\Users\walis\AppData\Local\Programs\orca\resources\bin\orca.exe"
if ($env:ORCA_CLI_COMMAND) { $ORCA=$env:ORCA_CLI_COMMAND }
& $ORCA status --json
& $ORCA orchestration run-list --json  # ver Runs ativos
```

Se `running: false` → `& $ORCA open --json` e tente novamente.

### Passo 2: Planner cria Run + Task(s)

```powershell
# Uma vez por wave/feature — reutilize o run para subtarefas
& $ORCA orchestration run-create --objective "Synkroo Wave X — <objetivo em 1 frase>" --json
# Guardar run_id retornado

# Criar 1 task por unidade entregável (coder consome 1 task por vez)
& $ORCA orchestration task-create --spec "CODER: <verbo> <alvo> | Arquivos: <paths> | Critério: <teste/comando> | TDD obrigatório" --json
```

Regra: `spec` deve conter **verbo + alvo + arquivos + critério de aceitação**. Sem isso o coder não sabe o que entregar.

### Passo 3: Dispatch assíncrono (sem await)

```powershell
# PREFERRED: worker-start (compõe worktree+terminal+dispatch+preamble)
& $ORCA orchestration worker-start --task <task_id> --worktree current --agent opencode --json
# Para coder antigravity: use terminal existente com antigravity
# & $ORCA terminal create --worktree active --command "antigravity" --json + dispatch --inject

# IMPORTANTE: planner NÃO roda check --wait longo aqui.
# Planner segue: planeja próxima task, revisa código, atende perguntas.
# O dispatch injeta preamble com taskId/dispatchId no terminal coder.
```

Concorrência: `current` mantém tudo no mesmo worktree (recomendado para Synkroo — depende de arquivos não commitados). Use `new-child` só se houver conflito real de checkout.

### Passo 4: Notificação coder → planner

**Coder** (trabalhador) — ao terminar, sempre notificar:

```powershell
& $ORCA orchestration send --type worker_done --subject "<status curto>" --body "<3 frases: o que fez, o que encontrou, o que falta>" --task-id <task_id> --dispatch-id <dispatch_id> --outcome succeeded --files-modified "path/a,path/b" --json
# Em falha:
& $ORCA orchestration send --type worker_done --subject "<motivo falha>" --body "<diagnóstico>" --task-id <task_id> --dispatch-id <dispatch_id> --outcome failed --json
```

**Planner** — consome notificações sob demanda (não bloqueante):

```powershell
# Poll curto (10-30s) — retorna vazio se nada novo, NÃO é erro
& $ORCA orchestration check --wait --types worker_done,escalation,question --timeout-ms 15000 --json

# Após processar cada worker_done aceito, liberar terminal:
& $ORCA orchestration worker-release --dispatch <dispatch_id> --json
# Se houver follow-up imediato no mesmo agente: worker-start --terminal <handle> --task <next_task>
# Para perguntas do coder:
& $ORCA orchestration reply --id <msg_id> --body "<resposta>" --json
& $ORCA orchestration check --ack <delivery_id> --wait --types worker_done,escalation,question --timeout-ms 15000 --json
```

Ver referência completa de tipos (`ask`, `escalation`, `heartbeat`) em [REFERENCE.md](REFERENCE.md).

## Checklist — antes de fechar wave

- [ ] `orca status --json` ok + Run correto bound no terminal planner
- [ ] Cada `worker_done` com `--outcome succeeded|failed` e `files-modified` preenchido
- [ ] Planner executou `worker-release` ou `worker-start --terminal <handle>` para cada dispatch encerrado
- [ ] `task-list --json` mostra `completed`/`failed` coerente (não `pending` órfão)
- [ ] Planner validou `npm run lint`, `npx tsc --noEmit`, `npm test` / `npm run verify` antes de aceitar entrega

## Quando usar

- `/orca-planner-coder` ou usuário pede "planner coder", "orquestração planner", "coder operacional", "sem await", "notificação ao terminar"
- Projeto com 2 terminais Orca no mesmo worktree e necessidade de coordenação supervisora

## Quando NÃO usar

- Handoff simples de propriedade total ("hand off", "dê para outro agente") — use `orca-cli` direto sem orchestration
- Tarefa de arquivo único sem necessidade de supervisão — faça direto

## Scripts

- `scripts/orca-resolve.ps1` — resolve `$ORCA` e valida `status`
- `scripts/orca-async-dispatch.ps1` — cria task + worker-start assíncrono
- `scripts/orca-poll.ps1` — poll curto não-bloqueante + ack
