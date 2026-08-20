# Synkroo Roadmap 143 Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converter os 143 itens reconciliados em uma DAG de goals e concluir o programa com 143/143 `VERIFIED`, hard gates verdes e rubrica final ≥90.

**Architecture:** `pi-tasks` mantém o plano persistente; cada `/goal` executa uma entrega falsificável de um a cinco itens fortemente acoplados. Seis planos de onda contêm os pacotes TDD; este arquivo governa ordem, ownership, gates, continuidade e encerramento.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, PostgreSQL 17, Drizzle ORM, Jest, Playwright, OpenNext, Cloudflare Workers/Hyperdrive/Queues/Durable Objects, GitHub Actions.

**Agent Orchestration:** Hierarchical — supervisor do programa → supervisor da onda → worker por goal → reviewer independente.

---

## 1. Autoridade e entradas

- Spec de produto: `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md`
- Spec do programa: `docs/superpowers/specs/2026-08-16-roadmap-143-goal-program-design.md`
- Roadmap reconciliado: `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md`
- Evidências existentes: `docs/superpowers/audits/`
- Estado inicial: 22 `VERIFIED`, 65 `PARTIAL`, 39 `UNVERIFIED`, 14 `EXTERNAL`, 3 `DEFERRED`
- Condição final: 143 `VERIFIED`, zero nos demais status

Não reabrir um item já verificado sem evidência de regressão. Revalidá-lo apenas quando uma mudança posterior tocar sua fronteira ou quando o gate da onda exigir regressão.

## 2. Estrutura de arquivos do programa

| Arquivo | Responsabilidade |
|---|---|
| `docs/superpowers/plans/2026-08-16-roadmap-143-master-implementation.md` | DAG, ownership, goal contract, gates e rubrica |
| `docs/superpowers/plans/2026-08-16-roadmap-143-wave-0-recovery.md` | working tree, verdade documental, baseline e blocker registry |
| `docs/superpowers/plans/2026-08-16-roadmap-143-wave-1-foundation.md` | F0–F3 |
| `docs/superpowers/plans/2026-08-16-roadmap-143-wave-2-clinical.md` | F4–F5 |
| `docs/superpowers/plans/2026-08-16-roadmap-143-wave-3-channels-ai.md` | F6–F7 |
| `docs/superpowers/plans/2026-08-16-roadmap-143-wave-4-business-lgpd.md` | F8–F10 |
| `docs/superpowers/plans/2026-08-16-roadmap-143-wave-5-release-pilot.md` | F11–F12 |
| `docs/superpowers/audits/roadmap-143-ledger.json` | ledger gerado durante O0; 143 registros e evidências |
| `docs/superpowers/audits/roadmap-143-final-rubric.md` | relatório final gerado na O5 |
| `docs/goals/roadmap-143-resume.md` | checkpoint de retomada entre sessões |

Arquivos de ledger e resume são entregáveis da execução, não são criados pelo planejamento.

## 3. Ownership dos 143 IDs

Cada faixa abaixo é inclusiva, contígua e pertence a exatamente um plano de onda.

| Onda | Faixa | Quantidade | Plano owner |
|---|---|---:|---|
| O1 | `F0.01–F0.10` | 10 | `2026-08-16-roadmap-143-wave-1-foundation.md` |
| O1 | `F1.01–F1.08` | 8 | `2026-08-16-roadmap-143-wave-1-foundation.md` |
| O1 | `F2.01–F2.19` | 19 | `2026-08-16-roadmap-143-wave-1-foundation.md` |
| O1 | `F3.01–F3.17` | 17 | `2026-08-16-roadmap-143-wave-1-foundation.md` |
| O2 | `F4.01–F4.11` | 11 | `2026-08-16-roadmap-143-wave-2-clinical.md` |
| O2 | `F5.01–F5.06` | 6 | `2026-08-16-roadmap-143-wave-2-clinical.md` |
| O3 | `F6.01–F6.15` | 15 | `2026-08-16-roadmap-143-wave-3-channels-ai.md` |
| O3 | `F7.01–F7.08` | 8 | `2026-08-16-roadmap-143-wave-3-channels-ai.md` |
| O4 | `F8.01–F8.07` | 7 | `2026-08-16-roadmap-143-wave-4-business-lgpd.md` |
| O4 | `F9.01–F9.09` | 9 | `2026-08-16-roadmap-143-wave-4-business-lgpd.md` |
| O4 | `F10.01–F10.10` | 10 | `2026-08-16-roadmap-143-wave-4-business-lgpd.md` |
| O5 | `F11.01–F11.15` | 15 | `2026-08-16-roadmap-143-wave-5-release-pilot.md` |
| O5 | `F12.01–F12.08` | 8 | `2026-08-16-roadmap-143-wave-5-release-pilot.md` |
| **Total** | `F0.01–F12.08` | **143** | — |

O0 não possui IDs; prepara o repositório e o ledger para executar os owners acima.

## 4. DAG e gates

```text
O0 Recovery
  │
  ├── Gate R: working tree reconciliado + ledger 143 + baseline
  ▼
O1 Foundation (F0–F3)
  │
  ├── Gate 1: security/auth/DB/CI/runtime
  ▼
O2 Clinical (F4–F5) ───────────────┐
  │                                 │
  └── Gate 2: contracts + J-04      │
                                    ▼
O3 Channels/AI (F6–F7) ───────→ Gate 3
  │                                 │
  ▼                                 │
O4 Business/LGPD (F8–F10) ←────────┘
  │
  ├── Gate 4: J-06/J-08/J-09 + finance races + lifecycle
  ▼
O5 Release/Pilot (F11–F12)
  │
  └── Gate Final: 143/143 + CI + receipts + score ≥90 + GO
```

O2 e pacotes internos de O3 podem avançar em paralelo depois de Gate 1 quando não compartilharem schema, CI ou contratos centrais. O4 inicia somente após contratos de O2 e canais/outbox de O3 necessários às suas jornadas.

## 5. Contrato obrigatório de um goal

Antes de cada `/goal`, criar uma tarefa atômica em `pi-tasks` e preencher:

| Field | Required content |
|---|---|
| Goal key | canonical key matching `O[0-5]-G[0-9]{2}-[a-z0-9-]+` |
| Roadmap IDs | one to five strongly coupled canonical IDs |
| Deliverable | one observable, falsifiable result |
| Dependencies | goal keys already `VERIFIED` |
| Risk | exactly `simple`, `relevant` or `critical` |
| Files | exact allowed paths |
| RED proof | exact test/command and expected failure |
| GREEN proof | exact test/command and expected output |
| Wave gate impact | exact affected gate commands |
| Forbidden | threshold reduction, new skips/retries, weakened assertions and hidden secrets |
| Blocker rule | emit a ready gate packet after two identical failures and one orthogonal attempt |
| Transcript proof | full command output, changed files, commit and residual risk |

Exemplo válido para o primeiro goal da O0:

```text
Preservar e classificar o working tree atual, proven by git status --short, git diff --check, targeted tests for every changed source cluster, and an evidence table mapping every changed/untracked path to roadmap IDs or generated-artifact disposition. Do not reset, stash-drop, overwrite, weaken tests, or stage unrelated files. Echo full verification output, changed files, dispositions, commit candidates, blockers, and remaining READY nodes.
```

## 6. Status operacional

```text
QUEUED → READY → ACTIVE → EVIDENCE_PENDING → VERIFIED
                    ├→ BLOCKED_R4
                    └→ BLOCKED_R5
```

- `READY`: todas as dependências verificadas e lane disponível.
- `ACTIVE`: um writer possui a lane.
- `EVIDENCE_PENDING`: implementação pronta, prova nominal incompleta.
- `BLOCKED_R4/R5`: gate humano pronto anexado.
- `VERIFIED`: requisitos e ledger completos.

Status documental do roadmap só muda após validação do ledger.

### Blocker routing R1–R5

| Class | Routing |
|---|---|
| R1 — resolvable | agent fixes code, test, config, document or local dependency |
| R2 — environmental | agent repairs local service/container/fixture or creates a reproducible fallback |
| R3 — authorized external | agent runs configured CI, PR, staging or provider action and captures receipts |
| R4 — human gate | owner supplies secret/cost/production/real-data/communication/irreversible authorization after safe preparation |
| R5 — decision | owner chooses between materially different alternatives outside delegated authority |

Wave-local `O*-X*` keys must declare one of R3–R5. R3 does not pause for owner approval when configured access exists. R4/R5 follow the packet below.

## 7. Gate packet humano

Todo gate R4/R5 deve conter:

| Required field | Required content |
|---|---|
| Gate key | unique R4/R5 key tied to the blocked goal |
| Roadmap IDs | every affected canonical ID |
| Blocked goal | exact goal key and current status |
| Reason | specific missing authority, credential, decision or external effect |
| Evidence and attempts | commands, outputs, two repeated failures and orthogonal attempt when applicable |
| Preparation completed | all safe work already finished |
| Minimal human action | one bounded action the owner can perform |
| Preconditions | access, backup and approved window |
| Risk | concrete impact and exposure |
| Rollback | exact reversal or containment procedure |
| Expected sanitized receipt | fields needed without secret values |
| Resume | exact command/goal transition after receipt |
| Independent READY nodes | work that continues while this gate waits |

A pausa global é inválida enquanto existir nó independente `READY`.

## 8. Gate commands

### Perfil simples

```bash
git diff --check
npm run lint -- --quiet
```

Acrescentar teste/validador exato do documento ou script alterado.

### Perfil relevante

```bash
npm run lint
npm run typecheck
# Run the exact focused RED/GREEN command named by the owning wave task.
```

Acrescentar integração do módulo e LSP dos arquivos alterados.

### Perfil crítico

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:integration:run
npm run test:security -- --runInBand
npm run test:release
npm run build
```

Acrescentar mutation, E2E, OpenNext, Wrangler, provider sandbox, race ou migration proof exigidos pelo pacote.

### Gate de onda

```bash
npm run verify
npm run test:integration:run
npm run test:security -- --runInBand
npm run test:release
npm run build
npm run test:e2e:production
npm run build:cf
npx wrangler deploy --dry-run --config wrangler.toml
```

O plano da onda registra quais comandos são aplicáveis e por quê. A CI remota deve executar no commit exato do gate.

## 9. Rubrica por goal

| Critério | Pontos |
|---|---:|
| Critérios e IDs satisfeitos | 4 |
| RED/GREEN e regressão | 2 |
| Revisão/adversarial por risco | 1 |
| Ledger e output surfaceado | 2 |
| Rollback/risco residual | 1 |
| **Total** | **10** |

Mínimo: 9/10, sem finding crítico/alto, sem gate obrigatório ausente e sem evidência parcial.

## 10. Rubrica final

| Dimensão | Peso |
|---|---:|
| 143 itens nominalmente fechados | 25 |
| Jornadas J-01–J-12 | 15 |
| Segurança, tenancy e LGPD | 15 |
| Dados, migrations e concorrência | 15 |
| Testes, coverage, mutation e revisão | 15 |
| Runtime, deploy, observabilidade e rollback | 10 |
| Operação, piloto e rastreabilidade | 5 |
| **Total** | **100** |

Hard gates: 143/143 `VERIFIED`; zero demais status; CI verde; coverage ≥70%; zero finding crítico/alto não aceito; migrations e rollback comprovados; J-01–J-12 aprovadas; receipts de staging/providers/drills/piloto; decisão `GO`.

## 11. Tarefas do supervisor

### Task 1: Executar O0

**Files:**
- Plan: `docs/superpowers/plans/2026-08-16-roadmap-143-wave-0-recovery.md`
- Create during execution: `docs/superpowers/audits/roadmap-143-ledger.json`
- Create during execution: `docs/goals/roadmap-143-resume.md`

- [ ] **Step 1:** Executar cada task da O0 na ordem.
- [ ] **Step 2:** Rodar Gate R e ecoar outputs completos.
- [ ] **Step 3:** Confirmar 143 registros únicos no ledger.
- [ ] **Step 4:** Commitar somente artefatos reconciliados da O0.

### Task 2: Executar O1

**Files:**
- Plan: `docs/superpowers/plans/2026-08-16-roadmap-143-wave-1-foundation.md`

- [ ] **Step 1:** Emitir um `/goal` por pacote `O1-G*` em ordem de dependência.
- [ ] **Step 2:** Continuar nós independentes quando houver gate humano.
- [ ] **Step 3:** Rodar Gate 1 no mesmo commit candidato.
- [ ] **Step 4:** Atualizar ledger e checkpoint.

### Task 3: Executar O2

**Files:**
- Plan: `docs/superpowers/plans/2026-08-16-roadmap-143-wave-2-clinical.md`

- [ ] **Step 1:** Executar pacotes `O2-G*`.
- [ ] **Step 2:** Provar contratos e J-04.
- [ ] **Step 3:** Rodar Gate 2 e atualizar ledger.

### Task 4: Executar O3

**Files:**
- Plan: `docs/superpowers/plans/2026-08-16-roadmap-143-wave-3-channels-ai.md`

- [ ] **Step 1:** Executar pacotes `O3-G*` respeitando contracts de O2.
- [ ] **Step 2:** Provar failure modes, Queue/retry/DLQ e consentimento.
- [ ] **Step 3:** Rodar Gate 3 e atualizar ledger.

### Task 5: Executar O4

**Files:**
- Plan: `docs/superpowers/plans/2026-08-16-roadmap-143-wave-4-business-lgpd.md`

- [ ] **Step 1:** Executar pacotes `O4-G*` após dependências de O2/O3.
- [ ] **Step 2:** Provar races financeiras e jornadas J-06/J-08/J-09.
- [ ] **Step 3:** Rodar Gate 4 e atualizar ledger.

### Task 6: Executar O5

**Files:**
- Plan: `docs/superpowers/plans/2026-08-16-roadmap-143-wave-5-release-pilot.md`

- [ ] **Step 1:** Executar pacotes locais de F11.
- [ ] **Step 2:** Preparar e resolver gates externos de F11/F12.
- [ ] **Step 3:** Executar J-01–J-12, drills e piloto aprovados.
- [ ] **Step 4:** Rodar Gate Final e produzir rubrica.

### Task 7: Encerrar o programa

**Files:**
- Create: `docs/superpowers/audits/roadmap-143-final-rubric.md`
- Modify: `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md`

- [ ] **Step 1:** Validar ledger com 143 IDs únicos e evidência completa.
- [ ] **Step 2:** Confirmar zero status não verificado.
- [ ] **Step 3:** Calcular rubrica de 100 pontos e hard gates.
- [ ] **Step 4:** Registrar risks, rollback e receipts.
- [ ] **Step 5:** Obter decisão formal `GO`.
- [ ] **Step 6:** Commitar relatório e reconciliação final.

## 12. Planning Readiness Gate (37/37)

States follow `C:/Users/walis/agent-config/docs/operations/PLANNING-READINESS.md`. `USER_ACTION_REQUIRED` below is future-wave input, not a blocker for O0; execution stops only at the owning gate if the receipt is absent.

| # | Readiness item | State | Evidence or disposition |
|---:|---|---|---|
| 1 | Objective | READY | 143/143 `VERIFIED`, hard gates green, rubric ≥90 and formal GO |
| 2 | Acceptance criteria | READY | goal contract, gate commands, per-goal and final rubrics |
| 3 | Scope | READY | exactly F0.01–F12.08, owned once in O1–O5 |
| 4 | Out of scope | READY | no silent backlog expansion; new feedback is separately triaged |
| 5 | Strategic decisions | READY | approved program spec fixes autonomy, evidence and gate policy |
| 6 | Architecture | READY | persistent DAG, serial wave gates and independent review |
| 7 | Repositories | READY | Synkroo repository and canonical inputs are local |
| 8 | Branches/worktrees | READY | O0 inventories current `main`; feature isolation occurs after recovery |
| 9 | Environments | READY | local and staging are authorized; production remains gated |
| 10 | Credentials | AGENT_CAN_PREPARE | use existing scoped credentials; missing/secret-changing access emits R4 |
| 11 | Authorizations | AGENT_CAN_PREPARE | push, PR and staging allowed; prod, secrets, cost and irreversible actions require R4/R5 |
| 12 | Access | AGENT_CAN_PREPARE | verify GitHub/Cloudflare/provider access just in time; emit minimal gate if absent |
| 13 | Chrome/profile | NOT_NEEDED | local implementation uses automated browser; authenticated human profile only if a future gate requires it |
| 14 | APIs/integrations | AGENT_CAN_PREPARE | contract tests first; real provider exercises use scoped staging bindings |
| 15 | MCPs/tooling | READY | Pi tools, browser, LSP, semantic review and subagents are available |
| 16 | Local services | READY | PostgreSQL health/reset/integration commands are specified |
| 17 | Docker | READY | project commands own local PostgreSQL lifecycle |
| 18 | VPS/SSH | NOT_NEEDED | target rollout is Cloudflare; VPS is not required by this program |
| 19 | Cloudflare | AGENT_CAN_PREPARE | OpenNext/Workers dry-run and authorized staging deploy are explicit |
| 20 | GitHub/environments | AGENT_CAN_PREPARE | CI and environment gates are implemented before release rollout |
| 21 | Database/migrations | READY | Drizzle/PostgreSQL, `DATABASE_URL`, expand/contract, backup and preflight defined |
| 22 | Data/fixtures | AGENT_CAN_PREPARE | synthetic fixtures now; approved/anonymized pilot dataset is O5-X02 |
| 23 | Staging | READY | staging execution is authorized; bindings and backup are technical preconditions |
| 24 | Tests | READY | TDD, focused/integration/security/release/E2E and adversarial commands defined |
| 25 | Evidence | READY | ledger schema requires command, output, commit, reviewer, risk, rollback and receipt |
| 26 | Review | READY | independent reviewer plus semantic/diff review at goal and wave gates |
| 27 | CI | AGENT_CAN_PREPARE | O1-G10 makes verify/coverage/security/build blocking |
| 28 | Deploy | AGENT_CAN_PREPARE | staging authorized; O5 orders DB→bridge→agent→app→smoke; production is gated |
| 29 | Backup | AGENT_CAN_PREPARE | required before migration/deploy and attached to gate receipt |
| 30 | Rollback | READY | compatibility, abort thresholds, rehearsal and roll-forward policy are planned |
| 31 | Loop selected | READY | subagent-driven execution, TDD, review and verification loops by risk |
| 32 | Iteration unit | READY | one falsifiable goal owns one to five strongly coupled IDs |
| 33 | Score/stop condition | READY | goal score ≥90; program score ≥90 plus every hard gate |
| 34 | Checkpoints | READY | commit and ledger update per goal; gate receipt per wave |
| 35 | Resume strategy | READY | `pi-tasks`, ledger and `docs/goals/roadmap-143-resume.md` |
| 36 | Human actions | READY | all owner-only actions are named R4/R5 packets with minimal action and rollback |
| 37 | Remaining blockers | READY | known future gates are attributed; none blocks O0 or autonomous local/staging work |

**Gate decision:** implementation may start at O0. There is no critical blocker for the first wave, the result is objectively verifiable, and future human-only inputs are isolated at their owning goals.

## 13. Condições de parada

Parar e registrar blocker quando:

- preflight detectar duplicata, tenant inesperado ou migration destrutiva não aprovada;
- credencial, tenant binding, consentimento ou idempotência estiver ausente antes de dispatch;
- backup, compatibility, smoke, alerting ou rollback estiver ausente antes de deploy;
- duas tentativas produzirem o mesmo erro e uma abordagem ortogonal também falhar;
- a fronteira inteira da DAG depender de R4/R5.

Nunca usar history rewrite, secret rotation, produção ou dados reais como correção automática.
