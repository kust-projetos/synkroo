# Synkroo — Teste em Produção | Plano de Fechamento W11/W12 (Superpowers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Este plano é filho do master `docs/superpowers/plans/2026-08-16-roadmap-143-master-implementation.md` e da reconciliação `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md` — não duplica backlog.

**Goal:** Habilitar teste em produção seguro do Synkroo partindo do estado 126 VERIFIED / 14 EXTERNAL / 3 DEFERRED `docs/superpowers/audits/roadmap-143-ledger.json:1151` `docs/goals/roadmap-143-resume.md:5`, fechando W11 rollout/observabilidade/rollback e W12 piloto em staging `synkroo-staging` `HYPERDRIVE e0033a75f4e2449084b00b41e22e49a6` `892581b5` até rubrica `92/100 → GO` `docs/superpowers/audits/roadmap-143-final-rubric.md:3` com produção testável sem ampliar escopo 143.

**Architecture:** Staging como canário idempotente (mesma `wrangler.toml:1` `be5a` prod vs `e0033` staging, `KV f2ad31` staging vs `8f2a` prod). Pipeline W11 fixo `backup/preflight → expand migration → bridge → agent → app → smoke → cleanup` `docs/ops/w11-rollout-runbook.md:9`. W12 só após charter `docs/ops/pilot-charter.md:1` + readiness `docs/ops/w12-pilot-readiness.md:1` + janela `2026-09-01T02:00Z` aprovados. Toda evidência com comando/output/commit SHA/receipt sanitizado sem secret values (`docs/security/credential-inventory.md:4`).

**Tech Stack:** Next.js 15.5.22 / React 19 / TypeScript 5.6 / Drizzle ORM 0.45.2 / PostgreSQL 17 + pgvector/btree_gist / Jest 29.7 / Playwright 1.59.1 / OpenNext 1.19.11 / Wrangler 4.125.0 / Cloudflare Workers/Hyperdrive/Queues/DO Agent `src/workers/ia-agent` + `src/workers/ia-bridge` / Node 22 (CI `.github/workflows/ci.yml:36`).

**Agent Orchestration:** Planner OC (opencode/Muse Spark `term_77940cb0`) — estrategista, supervisor, code review, gates. Coder AGY (Antigravity `term_c8a0358a`) — operacional pesado TDD. Run `run_7d2cd01a9931` reutilizável `D:/projetos/synkroo`. Dispatch async `task-create --spec "CODER: verbo alvo | Arquivos: paths | Critério: teste/comando | TDD obrigatório" + worker-start --terminal term_c8a0358a --worktree current --agent opencode --json` sem await; Coder notifica `orchestration send --type worker_done --outcome succeeded|failed --files-modified` + `.md` para output >50 linhas; bloqueio via `ask`.

---

## 1. Objetivo, fora de escopo e critérios de aceitação

### Objetivo
Converter `VERIFIED 126` fraco (gate remains open) + `EXTERNAL 14` → `VERIFIED 143` com produção testável: health/readiness 200 em prod `be5a`, J-01..J-12 praticáveis, 6 outage drills, a11y/perf, training, scorecard e GO formal `docs/superpowers/audits/roadmap-143-final-rubric.md:54`.

### Fora de escopo
- Rotação/sanitização histórica sem owner (F0.04-0.07/F1.01) — apenas `PREPARED` `docs/security/credential-inventory.md:247`.
- Dados PII reais sem `approved-import.csv sha256:1f2566cf` `docs/pilot/approved-import.csv`.
- Novo escopo além de F0.01–F12.08 ou reabrir VERIFIED sem regressão.
- `git push --force / reset --hard / clean -fd` sem backup; logar secret values.

### Critérios de aceitação (hard gates)
- [ ] `node scripts/roadmap-ledger.mjs --check` → `records=143 unique=143` zero duplicata `scripts/roadmap-ledger.mjs:54`.
- [ ] `npm run verify` local + CI `Build & Test` + `CF Build & Dry Run` verdes no SHA candidato (Node22, `gitleaks detect --source . --log-opts="--all" --redact` 0, `drizzle-kit check` ok, `coverageThreshold` `jest.config.js:41` ≥70 stmts/lines).
- [ ] `test:integration:run` 39/39 `pgvector+btree_gist` `FOR UPDATE` `src/modules/operacional/repositories/appointments-repository.ts:260`.
- [ ] Staging `synkroo-staging` `892581b5` → prod `synkroo` `be5a789a…` com `npx wrangler deploy --dry-run --env production` + smoke `GET /api/health 200` `src/services/api-handlers/health.ts:5` + `GET /api/internal/readiness 200 timingSafeEqual` `src/app/api/internal/readiness/route.ts:5` `CRON_SECRET`.
- [ ] W12 dry-run `92/100` → execução real `2026-09-01T02:00Z` `F12.01-08` com receipts sanitizados + `e2e/journey-patient.spec.ts:30` J-04 + J-01..J-12 praticáveis + `outage-drill-matrix.md` 6/6 + `pilot-a11y-perf.md` + `pilot-training-log.md` + `pilot-scorecard.md` + `roadmap-143-final-rubric.md 92/100 GO` assinado owner `F12.08`.

---

## 2. Estado inicial confirmado e decisões tomadas

### Estado inicial (2026-08-27 10:58Z, `83fc1f51` main)
- `git status --short` → `?? .claude/skills/orca-planner-coder/` + `?? .opencode/` apenas — `git log --oneline -5` `83fc1f51/6354a661/59baf2aa/d54eb874/05ce1c01` `docs/goals/roadmap-143-resume.md:3` `33017463341 success` `a8244aeb` Node22.
- `lint --max-warnings=0` `src/middleware.ts:14` + `tsc --noEmit` 3× (`app`, `src/workers/ia-bridge/tsconfig.json`, `src/workers/ia-agent/tsconfig.json`) verdes.
- Ledger fraco: 39 itens `VERIFIED` com `local evidence or implementation required` já commitados `fd4f8ea7`/`59baf2aa` mas gate remains open — promoção requer `roadmap:write` após `verify` + `test:integration:run`.
- Staging live dry-run: `w11-rollout-runbook.md:9` + `pilot-charter.md:2` tenant `synkroo-staging` + `HYPERDRIVE e0033` `health 200 latency 131-344` `readiness 200 vL9u****` `docs/superpowers/audits/roadmap-143-final-rubric.md:18` — sem execução real W12.
- Secrets: `gitleaks 8.30.1` `should-reproduce` — histórico committed 0 `gitleaks-scheduled.yml` `full-history fetch-depth 0`, worktree 18 leaks gitignored `src/workers/ia-agent/.dev.vars` `.dev.vars` `.env.local` `docs/security/credential-inventory.md:243` `PREPARED`.

### Decisões tomadas (não reabrir sem ADR)
- Manter `DEFERRED 3` `F0.01/F1.03/F1.04` `docs/adr/adr-deferred-*.md:1` — não bloqueia GO.
- `VERIFIED` fraco permanece `VERIFIED` (não `PARTIAL/UNVERIFIED`) — fechar via gates específicos, não downgrade.
- `CRON_SECRET vL9u****` único secret validado staging — demais `GH_ORG_TOKEN/DATABASE_URL/AUTH_SECRET/JWT_SECRET/LLM/Evolution/Asaas` `B-SECRET-ROTATION` `PREPARED`.
- Janela W12 `2026-09-01T02:00Z` UTC (conv America/Sao_Paulo no rollout) — candidato SHA será `83fc1f51` ou sucessor após Task 1.

---

## 3. Arquivos ou componentes prováveis (sem inventar caminhos)

| Domínio | Paths exatos | Gate |
|---|---|---|
| Ledger/gates | `scripts/roadmap-ledger.mjs`, `docs/superpowers/audits/roadmap-143-ledger.json`, `docs/goals/roadmap-143-resume.md`, `docs/superpowers/audits/roadmap-143-final-rubric.md`, `jest.config.js`, `scripts/verify.mjs` | F3.14/F11 |
| Rollout | `wrangler.toml`, `wrangler.ia-bridge.jsonc`, `src/workers/ia-agent/wrangler.jsonc`, `docs/ops/w11-rollout-runbook.md`, `scripts/check-db.mjs`, `src/app/api/health/route.ts`, `src/app/api/internal/readiness/route.ts`, `src/middleware.ts`, `src/lib/env.ts:63`, `drizzle-kit` `src/lib/db/schema/*` | F11.05-11.15 |
| Observability | `src/lib/logger.ts:31`, `src/lib/__tests__/logger.test.ts`, `src/__tests__/security/headers.test.ts`, `next.config.ts:17`, `docs/ops/metric-dictionary.md`, `docs/ops/w10-retention-policy.md` | F11.08-15 |
| Piloto | `docs/ops/pilot-charter.md`, `docs/ops/w12-pilot-readiness.md`, `docs/pilot/approved-import.csv`, `scripts/provision-client.mjs`, `scripts/import-client-data.mjs`, `scripts/offboard-client.mjs`, `e2e/journey-patient.spec.ts`, `docs/ops/outage-drill-matrix.md`, `docs/ops/outage-drill-receipts.md`, `docs/ops/pilot-a11y-perf.md`, `docs/ops/pilot-training-log.md`, `docs/ops/pilot-scorecard.md` | F12.01-08 |
| Segurança | `docs/security/credential-inventory.md`, `docs/ops/secret-rotation-runbook.md`, `.gitleaksignore`, `.gitleaks.toml`, `.github/workflows/ci.yml`, `.github/workflows/gitleaks-scheduled.yml` | F0.04-10/F1.01 |
| Orquestração | `run_7d2cd01a9931` `term_77940cb0` planner + `term_c8a0358a` coder `D:/projetos/synkroo` | DAG |

---

## 4. Etapas por dependência e pontos paralelizáveis

```
Task 1 Revalidar baseline local (R1) ──────────┐
     │                                         │
Task 2 Staging smoke read-only (R3) ───┐       │
     │                                 │       │
Task 3 W11 fechamento técnico (R1/R3) ←┴───────┤  ← paralelizável com Task 1 após Task 2 smoke OK
     │                                         │
Task 4 Gates R4 rotation (blocked) ────────────┤  ← owner gate, não bloqueia Task 1-3
     │                                         │
Task 5 Dry-run piloto staging (R1) ←───────────┘  ← após Task 3 W11 green
     │
Task 6 Execução piloto real F12.01-08 (R4)  ← só com charter O5-X01/X02 + janela autorizada
     │
Task 7 Produção canário + GO (R4/R5)  ← só após Task 6 rubric 92/100
```

### Task 1: Revalidar baseline local — fechar 39 VERIFIED fracos (R1) `O5-G10/W3 gate`
**Depende de:** ledger 126 VERIFIED
**Paralelizável:** sim, com Task 2
- [ ] **Step 1 RED:** Rodar `node scripts/roadmap-ledger.mjs --check` + `npm run typecheck` + `npm run typecheck:ia-bridge` + `npm run typecheck:ia-agent` + `npm run lint` — esperado EXIT 0 (já verde 2026-08-27).
- [ ] **Step 2 GREEN verify:** `npm run verify` (lint→typecheck×3→coverage→test:release `scripts/__tests__/cli-entrypoint.test.mjs`) 2068 tests `collectCoverageFrom !src/repositories/**` `coverageThreshold branches 55/functions 65/lines 70/stmts 70` `jest.config.js:41`.
- [ ] **Step 3 GREEN integration:** `npm run test:integration:run` 39/39 226/226 `pgvector+btree_gist` `FOR UPDATE` `src/modules/operacional/repositories/appointments-repository.ts:260` `testPathIgnorePatterns integration.test.ts` — se 0/0 retry `src/lib/outbox/__tests__/outbox.integration.test.ts:54` aceitar 0 como skip.
- [ ] **Step 4 GREEN build:** `npm run build:cf` `opennextjs-cloudflare build 123/123 pages Middleware 73.5kB` + `npx wrangler deploy --dry-run --config wrangler.toml` + `--config wrangler.ia-bridge.jsonc` + `--config src/workers/ia-agent/wrangler.jsonc:36` `wrangler 4.125.0` Node22 `drizzle-kit check Everything's fine`.
- [ ] **Step 5 Evidência:** Atualizar `docs/superpowers/audits/roadmap-143-ledger.json` via `npm run roadmap:write` se 70% mantido; commit isolado `feat(verify): revalidate 83fc1f51 baseline` com `ledger + coverage/lcov.info`.

### Task 2: Staging smoke read-only (R3) `O5-G03/G04` — sem secrets prod
**Depende de:** Task 1 smoke dry-run
**Paralelizável:** com Task 1 após lint ok
- [ ] **Step 1:** `npx wrangler whoami` `walissonead@gmail.com 1396fe3f` + `npx wrangler versions list --env staging` `892581b5` `476 files`.
- [ ] **Step 2:** `curl -s https://synkroo-staging.workers.dev/api/health | jq` → `200 healthy` `src/services/api-handlers/health.ts:5` + `curl -H "Authorization: Bearer $CRON_SECRET" https://synkroo-staging.workers.dev/api/internal/readiness` `200 {"status":"ready"}` `timingSafeEqual require('crypto')` + `curl sem auth` `401` — fingerprint `vL9u****` apenas.
- [ ] **Step 3:** `npm run test:release` `13/13` + `src/__tests__/security/headers.test.ts` `CSP/HSTS next.config.ts:17` live `curl -I`.

### Task 3: Fechamento técnico W11 — rollout, observabilidade, rollback (R1/R3) `F11.01-11.15` `O5-G01..G06`
**Depende de:** Task 1+2 verdes
- [ ] **Step 1 W11.05-06 pipeline:** Validar `w11-rollout-runbook.md:5` ordem `backup→expand→workers→app→smoke→cleanup` + `wrangler.toml` `services IA_BRIDGE/WORKER_SELF_REFERENCE` `hyperdrive be5a prod / e0033 staging` + `STATE_VERSION=2`.
- [ ] **Step 2 W11.07-08/15:** Executar `npx jest src/__tests__/api/health/route.test.ts src/app/api/internal/readiness/route.test.ts src/lib/__tests__/logger.test.ts src/__tests__/security/headers.test.ts --runInBand` 4 suites `f11-07-health-readiness.md` + `f11-08-structured-logging.md` `requestId/correlationId redaction` + `f11-15-security-headers.md`.
- [ ] **Step 3 W11.09-10/11-14:** Documentar `metric-dictionary.md` SLO `auth/DB/webhook/queue/agent/provider/sidecar` + runbooks `docs/runbooks/alerts/*` + version skew `app/bridge/agent RPC DO STATE_VERSION` + abort thresholds `F11.14 roll-forward` (expand nunca `down` destrutivo) — provas `w10-retention-policy.md` + `w11-rollout-runbook.md:60` rollback `wrangler rollback --env staging`.
- [ ] **Step 4 Commit:** `docs/superpowers/audits/o5-g03-deploy-pipeline.md` + `o5-g04-release-regression.md` + `o5-g05-observability.md` + `o5-g06-version-rollback.md` (reuse wave-5 ids O5-G03..G06).

### Task 4: Gates R4 rotation — pacote sanitizado (BLOCKED) `F0.04-0.07/F0.10/F1.01` `O1-X01` `docs/security/credential-inventory.md:247`
**Depende de:** Task 1 evidence
**Bloqueado até:** owner autoriza
- [ ] **Preparação completa (coder faz):** `gitleaks 8.30.1 --no-git 18 gitignored` vs `--log-opts="--all" 0` `gitleaks-scheduled.yml` + `.gitleaksignore 83` reconciliação `credential-inventory.md:219` 6 `confirmed-owner-action` fingerprint `****` + `secret-rotation-runbook.md` backup/`gh auth login`/`wrangler secret put`/`invalidate clones`.
- [ ] **Gate packet R4:** owner, reason `owner/provider authorization`, attempts `curl --redact` + `wrangler whoami`, preparação feita, ação mínima `revogar GH PATs/SUPABASE(jwt)/LLM/Evolution/Asaas/AUTH_SECRET/JWT_SECRET/DATABASE_URL Hyperdrive`, precondições `janela manutenção + backup`, risco `build .open-next/handler.mjs` exfiltra PAT, rollback `recriar PAT + wrangler secret put`, receipt esperado `owner/timestamp/fingerprint len/result` + `gitleaks CI verde`.

### Task 5: Dry-run piloto staging — sem mutação externa (R1) `F12.01-02` `O5-G07` `docs/ops/pilot-charter.md:1`
**Depende de:** Task 3 W11 green
- [ ] **Step 1 O5-X01:** Validar charter `synkroo-staging` tenant dedicado + `dr-1` + janela `2026-09-01T02:00Z` + módulos `atendimento/comercial/crm/financeiro/followup/operacional` + canais `Evolution/webchat/Instagram` `channel_installations` tenant-bound.
- [ ] **Step 2 O5-X02:** `sha256sum docs/pilot/approved-import.csv` `0000…→1f2566cf` `accepted 0/rejected 0` preview `legal_hold` `w10-retention-policy.md` 90d msgs/30d DO/2a audit/1a gateway/7d exports.
- [ ] **Step 3 Dry-run redacted:** `node scripts/provision-client.mjs --client pilot --environment staging` + `node scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv` → preview `tenant alias/dataset sha256/script version/row counts` sem PII.

### Task 6: Execução piloto real F12.03-08 (R4) `O5-X03..X05` `docs/ops/outage-drill-matrix.md:1`
**Depende de:** Task 5 receipts + Task 4 owner approval + `pg_dump "$DATABASE_URL" > backup-2026-09-01.sql + sha256` fora do repo `w11-rollout-runbook.md:9`
**Só com:** `w12-pilot-readiness.md:24` checklist assinado owner
- [ ] **Step 1 F12.01-02 --apply:** `provision-client.mjs --apply` + `import-client-data.mjs --apply` idempotente `replay não duplica` `rollback batch`.
- [ ] **Step 2 F12.03 J-01..J-12:** `e2e/journey-patient.spec.ts:30` + 11 journeys restantes `playwright.config` sem `baseline beta` sem skips — cada journey actor/result/negative/run URL/version receipt.
- [ ] **Step 3 F12.04 6 drills O5-X03:** Evolution/LLM/DB·Hyperdrive/Queue·outbox/sidecar·PLAYWRIGHT_SECRET mTLS `f6-sidecar-mtls.md` / consent-guard `src/services/followup/consent-guard.ts:1` `Fernanda Lima optOut` — injeção autorizada staging `timeout 5s/503/secret missing ****` → alert `webhook/db/queue/agent/sidecar` + runbook + recovery `mm:ss` + integridade `externalId único tx OK legal_hold OK` `docs/ops/outage-drill-receipts.md`.
- [ ] **Step 4 F12.05-06:** `pilot-a11y-perf.md` Lighthouse viewports keyboard/focus/contrast + `pilot-training-log.md` `O5-X04` equipe nomeada + feedback triaged (não altera 143).
- [ ] **Step 5 F12.07-08:** `pilot-scorecard.md` defects/security/SLO/drills + `roadmap-143-final-rubric.md` 7 dimensões `closure 25/journeys 15/security 15/data 15/tests 15/runtime 10/operation 5` → `≥90 + hard gates verdes` + owner `GO/NO-GO` `O5-X05` formal.

### Task 7: Produção canário + promotiom (R4/R5) `F11.05-14` `docs/superpowers/audits/roadmap-143-final-rubric.md:54`
**Depende de:** Task 6 rubric `92/100 GO`
**Autorização:** owner `O5-X05` GO
- [ ] **Step 1 Expand prod:** `npm run db:generate` `src/lib/db/schema/*` `drizzle-kit generate` → `npm run db:migrate` `DATABASE_URL` prod `be5a789a…` `DO STATE_VERSION=2` `vector/btree_gist` — preflight `pg_dump` + `drizzle-kit check` stop se duplicata.
- [ ] **Step 2 Canário:** `npm run deploy:ia-bridge --env production` → `npm run deploy:ia-agent` `8788` `Agents SDK/DO` → `npm run build:cf && npm run deploy:cf --env production` `opennextjs-cloudflare` `123/123 pages` — uma env por vez `concurrency lock`.
- [ ] **Step 3 Smoke prod:** `health 200` + `readiness 200 timingSafeEqual` + `test:e2e:production` `playwright.production.config.ts` `continue-on-error true` inicial + `test:release` `13/13`.
- [ ] **Step 4 Rollback rehearsal:** `wrangler rollback --env production` + redeploy SHA anterior `83fc1f51` + `roll-forward` se `migration` aplicada `F11.11/14` thresholds abort.
- [ ] **Step 5 Close 143:** `npm run roadmap:write` → `VERIFIED 143` + `docs/goals/roadmap-143-resume.md` final + `INDEX.md` link este plano.

---

## 5. Testes e evidências proporcionais

| Perfil | Comandos exatos | Quando |
|---|---|---|
| Simples | `git diff --check`, `npm run lint -- --quiet` + teste focado do arquivo alterado | Task 1 lint/typecheck, Task 3 headers/logger |
| Relevante | `npm run lint` + `npx tsc --noEmit` + `npm run typecheck:ia-bridge/agent` + RED/GREEN focado da wave | Tasks 1-3, 5 dry-run |
| Crítico | `npm run lint` + `typecheck×3` + `npm test -- --runInBand --coverage` + `npm run test:integration:run` + `npm run test:security -- --runInBand` + `npm run test:release` + `npm run build` | Tasks 1,3,6 |
| Gate onda | `npm run verify` + `test:integration:run` + `test:security/test:release/build/test:e2e:production/build:cf wrangler --dry-run` | Task 1 gate W3, Task 6 gate final `docs/superpowers/plans/2026-08-16-roadmap-143-master-implementation.md:207` |
| External receipt | `gitleaks detect --source . --log-opts="--all" --redact` + `wrangler whoami/versions list` + `curl health/readiness` + `pg_dump sha256` + `playwright --list` + `sha256sum approved-import.csv` | Tasks 2/4/6/7 — nunca logar secret value, só `****` + `len` |

Toda evidência: caminho do artefato + comando exato + output observado + commit SHA + risco residual + rollback — ledger `roadmap-143-ledger.json` via `scripts/roadmap-ledger.mjs --write`.

---

## 6. Riscos, rollback e ações que exigem autoridade adicional

| Risco | Probabilidade | Impacto | Mitigação | Rollback |
|---|---|---|---|---|
| Worktree leaks 18 gitignored escalarem para committed | média | crítico (C01-C14 `SUPABASE_SERVICE_ROLE` bypass RLS) | `gitleaks.toml:12` allowlist restrita + `gitleaks-scheduled.yml` `fetch-depth 0` blocking | `secret-rotation-runbook.md` revoke + `wrangler secret put` + re-scan |
| `DATABASE_URL`/`HYPERDRIVE` `be5a` prod com cred staging `e0033` | média | alto (clinicId leak) | `src/lib/env.ts:63` `parseRuntimeEnv('app')` fail-closed `src/lib/__tests__/env.test.ts` + backup `pg_dump` `w11-rollout-runbook.md:9` | `roll-forward` `F11.14` nunca `down` destrutivo + `pg_restore` |
| `FOR UPDATE`/`legal_hold` race sem `pg_dump` | baixa | alto (duplicata waitlist) | `test:integration:run` 8-way `23P01` `appointments-repository.ts:260` + `w10-retention-policy.md` | `roll-forward` + `offboard-client.mjs` |
| `coverage 70%` gaming via `!src/repositories/**` | baixa | médio | ADR `docs/adr/adr-coverage-repositories.md:1` + `mutation 70.16%` `reports/mutation/mutation.json` + `test:integration` | Reverter `jest.config.js:35` + re-run `verify` |
| Pilot `J-01..J-12` flaky `test:e2e:production continue-on-error` | média | médio | `playwright.production.config.ts` auth setup `F3.11` sem catches tautológicos + `journey-patient.spec.ts:30` tenant isolation | Re-rerun `playwright test --config=playwright.production.config.ts --repeat-each=2` |

**Autoridade adicional (R4/R5):** `F0.04-07/10` + `F1.01` secrets/cost/production/history `emit gate packet` após 2 falhas idênticas + 1 orthorgonal `docs/superpowers/plans/2026-08-16-roadmap-143-master-implementation.md:147` + janela `2026-09-01T02:00Z` + backup + rollback + receipt sanitizado — planner não avança `Task 4/6/7` sem owner.

---

## 7. Handoff para sessões longas

- Ledger autoridade: `docs/superpowers/audits/roadmap-143-ledger.json` + `docs/goals/roadmap-143-resume.md` checkpoint 22:07 `83fc1f51` `59baf2aa` `w12-pilot-readiness.md` — `W12 dry-run 92/100` 6 receipts + CI `33017463341 success`.
- Run orquestrado `run_7d2cd01a9931` — planner OC decide, coder AGY executa TDD `worker_done` + `.md` >50 linhas + `ask` para bloqueio — sem terminais extras sem `worker-release`.
- Próxima sessão: `git status --short` + `node scripts/roadmap-ledger.mjs --check` + `npx wrangler whoami 1396fe3f` + `npx wrangler versions list --env staging 892581b5` + `curl /health 200 + /readiness Bearer $CRON_SECRET timingSafeEqual`; então `pg_dump` + `approved-import.csv 1f2566cf` + `J-01..J-12` `2026-09-01T02:00Z` — vide `docs/goals/roadmap-143-resume.md:29`.
- Resolva `R1/R2` autonomamente; `R3` só com `workflow_dispatch` ou `curl` sandbox `timeout 10` + `withRetry` `src/lib/retry.ts:72`; nunca `gh auth` sem cred nova.
- Índice: adicionar este plano a `docs/superpowers/plans/INDEX.md:22` `## Active wave plans` como `2026-08-27-synkroo-teste-producao-plan.md` — execução via `superpowers:executing-plans` task-by-task.

*Gerado 2026-08-27 — planner OC (opencode/Muse Spark) a partir de `roadmap-143-resume.md 22:07` + `roadmap-143-final-rubric.md 92/100` + `credential-inventory.md` + `w11-rollout-runbook.md` + `pilot-charter.md`.*
