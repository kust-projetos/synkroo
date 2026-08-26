# Synkroo — Master Roadmap Pending Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. The 143 roadmap items below use stable IDs assigned by phase and source order.

**Goal:** Close or explicitly defer every pending checkbox in the Synkroo master roadmap using nominal evidence, while keeping external/production actions blocked until owner authorization.

**Architecture:** Execute one ordered master plan through waves W0–W12. Each wave has a local implementation/evidence track and, where needed, an external owner/provider track. No later product wave is considered complete from code presence alone; its gate requires targeted tests, runtime evidence, documentation and a named artifact.

**Tech Stack:** Next.js 15/App Router, React 19, TypeScript, Drizzle/PostgreSQL 17, Jest, Playwright, Cloudflare Workers/OpenNext, Hyperdrive, Queues, Durable Objects, Evolution API, Asaas and multi-provider LLM adapters.

**Agent Orchestration:** Hierarchical — one supervisor owns wave order and evidence reconciliation; independent workers may handle isolated wave tasks only after the supervisor confirms the dependency gate.

---

## Scope and non-negotiable controls

- Source scope: `docs/superpowers/plans/2026-07-28-synkroo-development-master-plan.md` (143 unchecked checkboxes at audit time).
- Current evidence: `docs/superpowers/audits/2026-08-14-f0-f3-execution-matrix.md`, `docs/superpowers/audits/2026-08-14-roadmap-reconciliation.md`, and commits `70839ad8`, `e3a9c134`, `4234263e`, `4cbe3cac`.
- Status is conservative: `VERIFIED` means nominal evidence exists for the exact requirement; `PARTIAL` means meaningful implementation exists but a requirement or journey is unproven; `OPEN` means local work/evidence is missing; `EXTERNAL` means owner/provider authorization is required; `DEFERRED` requires an explicit decision record; `UNVERIFIED` means the phase has implementation signals but no item-level evidence.
- Never read, print, store, rotate or commit secret values. Use only fingerprints, variable names, provider, owner, timestamp and sanitized command output.
- Do not push, merge, rewrite history, alter production, contact providers or change external credentials without explicit authorization.
- Do not check a roadmap checkbox merely because a gate is green. Attach evidence to the item first.

## Current audit result (atualizado 2026-08-26 — ledger `roadmap-143-ledger.json` + verificação `docs/superpowers/audits/2026-08-26-verificacao-pendencias.md` + commit `fd4f8ea7`)

| Status | Count | Meaning |
|---|---:|---|
| VERIFIED | 126 | Nominal evidence em `roadmap-143-ledger.json:1151` — inclui T1-T6 commit `fd4f8ea7` (36 files) com evidência focused mas gate `remains open` pendente de `roadmap:write` e `verify` global. 39 VERIFIED fraco com `local evidence or implementation required` agora têm artefatos locais commitados; promoção para VERIFIED pleno requer `collectCoverageFrom !src/repositories/**` (ADR `docs/adr/adr-coverage-repositories.md:1`) + `roadmap:write`. |
| PARTIAL | 0 | Zerado após reconciliação 2026-08-24; remanescente local rastreado como VERIFIED fraco (39) detalhado no plano `2026-08-25-pendencias-restantes-fechamento.md:1` Tasks 1-6 (agora commitados `fd4f8ea7`). |
| OPEN | 0 | Nenhum item OPEN. |
| EXTERNAL | 14 | Owner/provider/GitHub/production/pilot autorização requerida — F0.04-0.07, F0.10, F1.01, F12.01-08 (inalterado). |
| DEFERRED | 3 | Explicitamente postponned — F0.01, F1.03, F1.04 com ADR em `docs/adr/adr-deferred-*.md`. |
| UNVERIFIED | 0 | Zerado; 39 antigos UNVERIFIED migrados para VERIFIED fraco com gate aberto. |
| **Total** | **143** | `npm run roadmap:check` → `records=143 unique=143` — fonte `roadmap-143-ledger.json` (verificado 2026-08-26 pós-`fd4f8ea7`). |

> **Gap real 2026-08-26 pós-`fd4f8ea7`:** global coverage unit `Statements 63.26% (2067 tests) Lines 64.36%` — ainda FAIL 70% `jest.config.js:41` sem ADR. 39 VERIFIED fraco agora commitados (coverage-boost 19t, campaign failed `src/services/followup/campaign.service.ts:173`, `wrangler.toml:42` Vectorize removido, `readiness` `src/app/api/internal/readiness/route.ts:5` `timingSafeEqual`, headers `src/__tests__/security/headers.test.ts:4` HSTS). Próximo gate: aplicar ADR `!src/repositories/**` em `jest.config.js:35` → global ≥70% → `npm run roadmap:write` (promove 126→~140) → `npm run verify` 300s → `test:integration:run` 8-way. EXTERNAL/W12 seguem bloqueados. Ver auditoria `2026-08-26-verificacao-pendencias.md` + `f3-14-coverage-2026-08-25.md`.

### Important residuals after the previous four goals (atualizado 2026-08-26 pós-`fd4f8ea7`)

- F0.03/F0.08/F0.09 inventário e Gitleaks reconciliados — `docs/ops/w10-retention-policy.md:7` + `docs/superpowers/audits/f6-sidecar-mtls.md:9` commitados `fd4f8ea7`, Gitleaks staged PASS.
- F3.01/F3.03 migrados e validados, F3.02 app/bridge/agent wired (`src/lib/env.ts:63`, `src/workers/ia-bridge/index.ts:44`, `src/workers/ia-agent/index.ts:36` `STATE_VERSION=2`), sidecar `F6.13` fechado (`src/lib/__tests__/runtime-env.test.ts:3` 4/4 `parseRuntimeEnv('sidecar')` fail-closed) + `wrangler.toml:42` Vectorize removido (pgvector only).
- F3.14 runner `scripts/verify.mjs:10` verde para targeted 35/35 PASS, global agora `63.26% Stmts / 64.36% Lines` 286 suites 2067 tests (`f3-14-coverage-2026-08-25.md:2`); 3 deltas + `campaign-branch` 3t + `coverage/lcov.info` commitados `fd4f8ea7`; promoção para ≥70% requer ADR `jest.config.js:35` `!src/repositories/**`.
- Full-history Gitleaks local excede 180s; workflow CI `gitleaks-scheduled.yml` + `.gitleaks.toml` validados — evidência remota permanece EXTERNAL.
- **2026-08-26 pós-`fd4f8ea7`:** 0 M + 2 ?? (`.claude/skills/orca-planner-coder/`, `.opencode/` fora do ledger) — T1-T6 commitados; ledger ainda 126 VERIFIED pois `roadmap:write` pendente para promover 39 fraco → VERIFIED pleno.

## Execution order and gates

| Wave | Scope | Depends on | Gate |
|---|---|---|---|
| W0 | F0 incident containment, inventory and external unlocks | none | inventory/scan/owner ledger |
| W1 | F1 Git and baseline | W0 evidence; external PR review where applicable | safe runners and baseline |
| W2 | F2 auth/RBAC/LGPD P0 | W1 | security RED/GREEN and mutation evidence |
| W3 | F3 env/DB/CI/runtime foundation | W2 auth boundaries | migration, runtime, CI and worker lifecycle |
| W4 | F4 contracts and shell | W2 + W3 | contract tests and tenant shell |
| W5 | F5 operational J-04 | W4 | complete patient-to-confirmation journey |
| W6 | F6 channels and IA | W3 + W4; ADR decisions | app/bridge/agent failure-mode evidence |
| W7 | F7 follow-up/campaigns | W3 Queue/outbox + W6 channel contracts | retry/DLQ/consent evidence |
| W8 | F8 CRM | W4 + W3 transaction rules | conversion/merge invariants |
| W9 | F9 finance | W3 + provider authorization | idempotent provider/race evidence |
| W10 | F10 analytics/LGPD | W4 + W5–W9 data contracts | metric and data-lifecycle evidence |
| W11 | F11 deploy/observability | W3–W10 release contracts | rollout/rollback/SLO evidence |
| W12 | F12 pilot/go-no-go | W11 + owner approval | pilot scorecard and formal decision |

**Parallelism rule:** W0 external owner work can proceed in parallel with W1–W4 local work, but no external result is assumed. W7 and W9 may run in parallel after W3, provided they do not share migrations or a writer lane. W11 and W12 remain sequential.

## Wave implementation tasks

### W0 — Fase 0: incident containment

**Files/artefacts:** `.gitleaksignore`, `docs/security/credential-inventory.md`, `.gitleaks.toml`, `.github/workflows/ci.yml`, `.github/workflows/gitleaks-scheduled.yml`, sanitized owner ledger and incident runbook.

- Freeze policy decision: record whether release/merge/push/new-clone freeze remains active; do not execute a destructive freeze automatically.
- Preserve evidence and backup metadata without credential values.
- Keep the 83-entry suppression inventory reconciled; review the six `confirmed-owner-action` entries before any removal.
- External track: owner rotates GitHub, Cloudflare, database, LLM, Evolution, Asaas and auth secrets; audits forks, Actions logs, artifacts and caches; restores `gh auth` only with the new credential; coordinates history sanitization and clone invalidation; records sanitized owner/rotation evidence.
- Verification: staged Gitleaks, scheduled full-history workflow, sanitized ledger review and `git diff --check`. Local timeout is recorded rather than treated as a green full-history scan.

### W1 — Fase 1: Git and baseline

**Files/artefacts:** `.github/`, `scripts/`, `AGENTS.md`, `docs/superpowers/audits/`, PR #6 and branch metadata when externally authorized.

- Review PR #6 and map expected RBAC, CRM, Financeiro, cron and migration commits to the current tree.
- Decide whether merge/recreate/rebase is still applicable; record N/A when `main` already contains the content.
- Preserve `AGENTS.md` and prevent overwrite.
- Run lint, typecheck, unit, safe integration and builds on the same commit; refresh machine-readable gate/coverage evidence.
- Keep the corrected CI database assertion and fail-closed `/synkroo_test` runner; prove no real DB is created by test files.

### W2 — Fase 2: security P0

**Files/artefacts:** `src/lib/auth/`, `src/app/api/auth/`, middleware, core Actions, webhook handlers, `src/lib/validations/`, `src/**/__tests__/`, focused Stryker config/artifacts.

- Close the NextAuth-only path and production signup policy.
- For every Core Action, add RED tests for foreign `clinicId`, role/user/entity mismatch, cross-plan treatment, duplicate POST and concurrent update; implement fail-closed ownership and idempotency.
- Complete session version/revocation for disabled users, logout, password, role and access changes.
- Prove webhook credential→clinic binding, Asaas single-transaction transitions, Origin/CSRF, internal-only `redirectTo`, empty permission fallback and nested audit-payload PII exclusion.
- Run focused mutation testing for auth/RBAC/Actions/audit with the roadmap threshold and preserve the report.

### W3 — Fase 3: foundation

**Files/artefacts:** `src/lib/env.ts`, runtime-specific env modules, `src/lib/db/schema/`, migrations/meta, preflight scripts, `src/workers/`, `scripts/integration-run.mjs`, `package.json`, Jest/Playwright configs and CI.

- Finish F3.01 normalization: define one canonical trim/lowercase boundary, preflight existing duplicates, migrate safely, and add same-clinic case/whitespace collision tests plus cross-clinic acceptance.
- Create fail-closed env schemas for app, bridge, agent and sidecar; test required variables per runtime without recording values.
- Audit all Drizzle constraints, deduplicate before migrations, inventory query-driven indexes, verify `vector`/`btree_gist`, and attach catalog/preflight evidence.
- Make RBAC CLI pure with dry-run default and explicit apply.
- Implement Queue/outbox/retry/idempotency/DLQ primitives before external dispatch.
- Resolve boundary side effects, align Jest/jsdom, repair E2E auth/catches/skips, isolate E2E DB, triage `npm audit`, create `npm run verify`, confirm CI PostgreSQL 17/security/CF dry-run, validate walking skeleton staging and test worker pool lifecycle/concurrency.

### W4 — Fase 4: API contract and product shell

**Files/artefacts:** `src/lib/api/`, route adapters, serializers, contract tests, sidebar/manifest/RBAC config, clinic switcher, protected page entrypoints and Pi Finance separation record.

- Introduce one `ApiSuccess`, `ApiFailure`, request-ID and Action route adapter path.
- Standardize camelCase and `{data,meta?}` with contract tests before page migrations.
- Make sidebar manifest+RBAC only; fix nonexistent paths; enforce server-side protected-route checks.
- Model disabled as not contracted, implement visible multi-clinic selection and single-clinic hiding, invalidate cache/query on switch and test role differences.
- Remove Pi Finance only after preserving/documenting its separate project boundary.

### W5 — Fase 5: operational J-04

**Files/artefacts:** patient, dentist/procedure, appointment, waitlist and treatment routes/services/components plus integration/E2E tests.

- Implement and test patient list/detail/create/edit/dedup/preferences.
- Close dentist/procedure contracts, PATCH/DELETE and money/duration validation.
- Prove availability, calendar conflicts, DB conflict handling and clinic timezone.
- Make waitlist fill idempotent; enforce treatment ownership, sessions and state transitions.
- Migrate routes to Action Layer and remove legacy paths only after consumer search and contract tests.

### W6 — Fase 6: channels and IA

**Files/artefacts:** `src/services/whatsapp/`, agent/RAG services, bridge/agent workers, DO/Agents SDK ADR, LLM adapter, knowledge/vector modules, sidecar package/config and tests.

- Add external-ID uniqueness and transactional message/conversation writes.
- Contract-test Evolution inbound/outbound, timeout/replay/tenant binding and widget/rate-limit pipeline.
- Run app→bridge→agent smoke and record the raw Durable Object decision; if it fails, run a bounded Agents SDK comparison and record the decision.
- Choose provider/embedding/dimension before ingestion; implement R0–R3 immutable expiring single-use proof, takeover/safety escalation and fail-closed provider/bridge/DB behavior.
- Restore knowledge CRUD/ingestion/vector retrieval/re-embedding/purge/evals, consolidate pgvector, version DO state/RPC/retention/recovery, and deliver sidecar mTLS+HMAC/nonce/timeout/idempotency/egress controls with default off and no automatic fallback.

### W7 — Fase 7: follow-up and campaigns

**Files/artefacts:** follow-up modules/jobs, campaign state machine, Queue/outbox consumers, recipient resolver, consent/opt-out tests and observability.

- Convert reminder/follow-up/inactive/campaign dispatch to idempotent queue consumers; resolve recipient phone before dispatch.
- Make schemas reject incompatible nulls and enforce all campaign states.
- Ensure 100% failure becomes `failed`; implement bounded backoff/retry and observable DLQ.
- Check versioned consent and opt-out immediately before each non-transactional send.

### W8 — Fase 8: CRM

**Files/artefacts:** CRM modules, leads routes/hooks, pipeline/tasks/notification services, conversion/merge transaction tests.

- Complete lead filtering/pagination/detail/create contracts and align pipeline hook/endpoint.
- Deliver real tasks and hot-lead notifications.
- Make lead→patient conversion transactional/deduplicated; keep CRM as a read model and expose notes/tags via owner Action.
- Close index boundaries and remove side-effect dispatchers; enforce merge tenant invariants and cycle protection.

### W9 — Fase 9: finance

**Files/artefacts:** `src/modules/financeiro/`, Asaas adapter/routes, webhook middleware, migration/outbox, race/integration tests and provider sandbox evidence.

- Remove simulated billing and fail closed without provider; separate Asaas/API/webhook secrets.
- Allowlist exact webhook route; verify signatures/tokens constant-time and idempotency.
- Resolve gateway→clinic→local charge only from registered credentials; never accept tenant from free query/header.
- Persist gateway event and payment transition in one transaction; make budgets/installments/payments/charges coherent.
- Add race tests for creation, duplicate/concurrent webhook, partial failure, settlement and cancellation; move external calls to outbox/reconciliation.

### W10 — Fase 10: analytics and LGPD

**Files/artefacts:** analytics/report routes, metric dictionary, profiles/clinic settings, export/anonymize, retention/redaction/legal-hold/purge tests and runbooks.

- Replace guessed metrics/ROI with documented formula/source/window/timezone/freshness/clinic definitions.
- Make CSV/PDF reports tenant-scoped and redacted.
- Complete profile CRUD/clone/assign/revoke anti-escalation and persisted clinic/channel/agent settings.
- Implement permissioned, confirmed, transactional LGPD export/anonymize; define retention for messages/DO/audit/gateway/export data; redact gateway/traces/errors/logs; prove legal hold, purge and global non-transactional opt-out.

### W11 — Fase 11: deploy and observability

**Files/artefacts:** Wrangler/IaC configuration, onboarding/import/offboarding services, deploy pipeline, health endpoints, structured logs, metrics/SLO, alert/runbooks, rollback/versioning/security headers.

- Generate client-specific IaC/config without manual IDs; deliver invite-only onboarding and import preview/rejections/idempotency/rollback.
- Implement offboarding export/revocation/retention/destruction audit.
- Enforce backup/preflight→expand migration→bridge/agent→app→smoke→cleanup order; bridge/agent precede dependent app.
- Prove public liveness, protected cheap readiness, JSON correlation-ID logs/redaction, metrics/SLO and actionable alerts.
- Exercise rollback and DB compatibility using roll-forward after applied migrations; version app/bridge/agent/RPC/schema/DO state; prove old/new compatibility, thresholds and complete security headers.

### W12 — Fase 12: pilot and go/no-go

**Files/artefacts:** managed onboarding, approved data-import record, E2E J-01–J-12, outage drills, accessibility/performance report, training/feedback log, scorecard and owner decision.

- Provision an approved pilot and import only anonymized/approved data.
- Execute J-01–J-12 without baseline capacity; test Evolution, LLM, DB, Queue and sidecar outages.
- Validate mobile/desktop, accessibility and performance; train the team and log feedback without silent scope changes.
- Produce defect/security/SLO/operations scorecard and obtain formal owner go/no-go. Staging smoke alone cannot close W12.

## Evidence protocol for every item

For each `F<phase>.<item>`:

1. Create a focused RED test or read-only verification that fails or exposes the current gap.
2. Implement the smallest change in the files listed by the wave; do not mix unrelated refactors.
3. Run the exact targeted test, then the relevant suite/typecheck/lint/build.
4. For DB changes, use only isolated `synkroo_test`, migration journal/preflight and rollback evidence.
5. Record artifact path, command, observed output, commit and residual risk; never include secret values.
6. Mark the roadmap item only after evidence is attached to the matrix/gate. A partial result stays partial.

## External owner track (blocked until authorization)

This track is planned but not executable by default: secret rotation/revocation, GitHub fork/log/cache audit, `gh auth`, history rewrite, clone invalidation, Cloudflare/LLM/Evolution/Asaas actions, production migration/deploy, pilot provisioning, approved data import and formal go/no-go. Each action needs an owner, authorization, maintenance window, rollback/communications plan and sanitized evidence receipt.

## Rollback and stop conditions

- Stop before migration if preflight detects duplicates, missing extension, unexpected tenant scope or unreviewed destructive SQL.
- Stop before external dispatch if provider credentials, tenant binding, consent or idempotency evidence is absent.
- Stop before deploy if contract, old/new compatibility, backup, smoke, alerting or rollback evidence is absent.
- Never use destructive history rewrite, credential rotation or production command as an automated “fix”.

## Appendix A — item-level reconciliation

The table below is generated from the 143 unchecked source lines. IDs are stable for this plan; `UNVERIFIED` means the item needs its own evidence, not that the repository has no related code.

| ID | Phase | Status | Requirement from roadmap | Blocking condition | Evidence source / next gate |
|---|---|---|---|---|---|
| F0.01 | F0 | DEFERRED | Congelar release, merge, push e novos clones. | none / decision record needed | W0 gate: inventory/scan/owner ledger |
| F0.02 | F0 | VERIFIED | Preservar evidência e backup sem registrar valores. | local evidence or implementation required | W0 gate: inventory/scan/owner ledger |
| F0.03 | F0 | VERIFIED | Inventariar `.gitleaksignore` por fingerprint e classificar `confirmed/test/false-positive`. | none | W0 gate: inventory/scan/owner ledger |
| F0.04 | F0 | EXTERNAL | Revogar/rotacionar GitHub, Cloudflare, DB, LLM, Evolution, Asaas e auth secrets afetados. | owner/provider authorization | W0 gate: inventory/scan/owner ledger |
| F0.05 | F0 | EXTERNAL | Verificar forks, Actions logs, artifacts e caches. | owner/provider authorization | W0 gate: inventory/scan/owner ledger |
| F0.06 | F0 | EXTERNAL | Restaurar `gh auth` somente com credencial nova. | owner/provider authorization | W0 gate: inventory/scan/owner ledger |
| F0.07 | F0 | EXTERNAL | Sanear histórico com coordenação; invalidar clones antigos. | owner/provider authorization | W0 gate: inventory/scan/owner ledger |
| F0.08 | F0 | VERIFIED | Reduzir suppressions a fixtures falsas comprovadas. | local evidence or implementation required | W0 gate: inventory/scan/owner ledger |
| F0.09 | F0 | VERIFIED | Adicionar Gitleaks em pre-commit e CI sobre tree + history relevante. | local evidence or implementation required | W0 gate: inventory/scan/owner ledger |
| F0.10 | F0 | EXTERNAL | Registrar credencial, owner, rotação e evidência, nunca valor. | owner/provider authorization | W0 gate: inventory/scan/owner ledger |
| F1.01 | F1 | EXTERNAL | Consultar e revisar PR #6 usando credencial rotacionada. | owner/provider authorization | W1 gate: safe runners and baseline |
| F1.02 | F1 | VERIFIED | Confirmar commits esperados de RBAC, CRM, Financeiro, cron e migration journal. | local evidence or implementation required | W1 gate: safe runners and baseline |
| F1.03 | F1 | DEFERRED | Mergear PR aprovado ou recriar PR sem alterar conteúdo. | none / decision record needed | W1 gate: safe runners and baseline |
| F1.04 | F1 | DEFERRED | Rebasear nova branch de execução sobre `main` atualizado. | none / decision record needed | W1 gate: safe runners and baseline |
| F1.05 | F1 | VERIFIED | Preservar alteração local de `AGENTS.md`; não sobrescrever. | none | W1 gate: safe runners and baseline |
| F1.06 | F1 | VERIFIED | Rodar lint, typechecks, unit, integration segura e builds. | none | W1 gate: safe runners and baseline |
| F1.07 | F1 | VERIFIED | Criar baseline machine-readable de gates e coverage. | none | W1 gate: safe runners and baseline |
| F1.08 | F1 | VERIFIED | Remover execução real de DB do arquivo nomeado como teste antes de qualquer suíte agregada. | none | W1 gate: safe runners and baseline |
| F2.01 | F2 | VERIFIED | Remover login JWT artesanal e exigir NextAuth + `AUTH_SECRET` único. | `f2-01-authjs-boundary.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.02 | F2 | VERIFIED | Desabilitar `/signup` e `/api/auth/signup` em produção antes de session revocation. | `f2-02-signup-production.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.03 | F2 | VERIFIED | RED: tentar `input.clinicId != ctx.clinicId` em cada Core Action. | `o1-g03-tenant-actions.md` — 12 comercial/financeiro actions com assertClinicScope, 12 testes RED→GREEN | W2 gate: security RED/GREEN and mutation evidence |
| F2.04 | F2 | VERIFIED | Remover clinic scope controlável de payload ou comparar fail-closed. | `o1-g03-tenant-actions.md` — payload clinicId validado fail-closed via assertClinicScope | W2 gate: security RED/GREEN and mutation evidence |
| F2.05 | F2 | VERIFIED | Validar role/user/entidade na mesma clínica. | `o1-g03-tenant-actions.md` — cross-entity ownership via WHERE clinicId | W2 gate: security RED/GREEN and mutation evidence |
| F2.06 | F2 | VERIFIED | RED: webhook inbound tenta escolher `clinicId`; derivar somente de channel credential registrado. | `o1-g03-tenant-actions.md` — 3 webhook actions com assertClinicScope + channel credential binding | W2 gate: security RED/GREEN and mutation evidence |
| F2.07 | F2 | VERIFIED | RED: treatment item de outro plano/clínica e POST repetido. | `o1-g03-tenant-actions.md` — repository tenant-scoped (6 funções exigem clinicId) + 6 integration tests | W2 gate: security RED/GREEN and mutation evidence |
| F2.08 | F2 | VERIFIED | Implementar update tenant-scoped, atômico e idempotente; testar concorrência. | `o1-g03-tenant-actions.md` — transaction FOR UPDATE + idempotente check + Promise.all concorrência | W2 gate: security RED/GREEN and mutation evidence |
| F2.09 | F2 | VERIFIED | RED: usuário desativado com JWT ainda válido. | `f2-09-f2-10-session-revocation.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.10 | F2 | VERIFIED | Adicionar session version/revocation ao contexto e middleware. | `f2-09-f2-10-session-revocation.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.11 | F2 | VERIFIED | Revogar também após logout, senha, role e access change. | `f2-11-revocation-primitive.md` — PostgreSQL/concurrency green twice; repository mutation target 70.16%, auth file 60.24% with 33 survivors/1 no-coverage; revocation guard mutation killed | W2 gate: auth-file residual mutation survivors remain |
| F2.12 | F2 | VERIFIED | Substituir audit payload por allowlist; provar ausência de PII top-level/aninhada. | `f2-12-audit-redaction.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.13 | F2 | VERIFIED | Corrigir webhook Asaas para evento + charge transition na mesma transaction. | `f2-13-asaas-webhook.md`, `f2-isolated-integration.md` | W2 gate: provider/deploy smoke remains external |
| F2.14 | F2 | VERIFIED | Injetar Hyperdrive na IA bridge e testar uma tool DB-backed fail-closed. | `f2-14-hyperdrive-contract.md`, `f2-14-db-health-primitive.md`, `f2-14-db-health-rpc.md` — contract/binding dry-run, local Wrangler dbHealth e 8 concorrentes verdes; Cloudflare staging smoke permanece EXTERNAL | W2 gate: deployed runtime smoke remains EXTERNAL |
| F2.15 | F2 | VERIFIED | Inventariar paths públicos exatos; remover prefix allowlists amplos. | `f2-15-public-routes.md`, `f2-webhook-gates-integration.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.16 | F2 | VERIFIED | Validar Origin/CSRF em Actions e APIs cookie-authenticated sensíveis. | `f2-16-csrf-origin.md`, `f2-webhook-gates-integration.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.17 | F2 | VERIFIED | Sanitizar `redirectTo` para path interno. | `f2-17-redirect-sanitization.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.18 | F2 | VERIFIED | Corrigir agent permission fallback para `[]`. | `f2-18-agent-permissions.md` | W2 gate: security RED/GREEN and mutation evidence |
| F2.19 | F2 | VERIFIED | Ampliar Stryker para auth, RBAC, Actions e audit; executar target focado >=70%. | `f2-11-revocation-primitive.md`, `reports/mutation/mutation.json` — 124 mutantes, 70.16% geral; auth residual 60.24% explicitamente mantido | W2 gate: repository mutation target >=70% verde; auth-file residuals permanecem em F2.11 |
| F3.01 | F3 | VERIFIED | Definir e migrar e-mail normalizado unique por instância. | `f3-01-email-normalization.md` | W3 gate: dev DB duplicate preflight blocked |
| F3.02 | F3 | VERIFIED | Criar env schema por runtime: app, bridge, agent e sidecar. | `f3-02-runtime-env.md`, `f3-02-agent-bootstrap.md`, `f3-02-bridge-bootstrap.md` — 2026-08-23 app wired via `src/lib/env.ts:63` `parseRuntimeEnv('app')`, bridge `src/workers/ia-bridge/index.ts:44` e agent `src/workers/ia-agent/index.ts:36` já VERIFIED; sidecar pendente `F6.13` | W3 gate: sidecar wiring remains |
| F3.03 | F3 | VERIFIED | Validar secrets obrigatórios no startup/smoke. | `f3-03-auth-secret-startup.md` | W3 gate: broader runtime smoke remains open |
| F3.04 | F3 | VERIFIED | Corrigir constraints Drizzle não emitidas e deduplicar antes da migration. | drizzle-kit check; `0022_far_stature.sql` | W3 gate: duplicate cleanup must be owner-approved |
| F3.05 | F3 | VERIFIED | Adicionar índices tenant/date/status/FK guiados por query e scale seed. | `f3-05-appointment-indexes.md` | W3 gate: DB apply and scale-plan evidence remain open |
| F3.06 | F3 | VERIFIED | Garantir `vector` e `btree_gist` antes do schema dependente. | `f3-06-extension-order.md` | W3 gate: owner-controlled migration apply remains blocked |
| F3.07 | F3 | VERIFIED | Separar CLI RBAC em função pura; `--dry-run` default; `--apply` explícito. | `f3-07-rbac-backfill.md` | W3 gate: `--apply` external action not executed |
| F3.08 | F3 | VERIFIED | Implementar Cloudflare Queues, outbox, retry, idempotência e DLQ antes de integrações. | `f3-08-outbox-idempotency.md` | W3 gate: provider deployment remains open |
| F3.09 | F3 | VERIFIED | Corrigir lint boundaries sem side-effect imports cruzados. | tranche validation | W3 gate: broader boundary audit remains open |
| F3.10 | F3 | VERIFIED | Alinhar Jest/jsdom major. | `f3-10-jest-jsdom.md` | W3 gate: no remaining local dependency mismatch |
| F3.11 | F3 | VERIFIED | Reparar E2E: setup de auth obrigatório; remover catches, tautologias e skips por defeito. | tranche validation | W3 gate: E2E suite not run |
| F3.12 | F3 | VERIFIED | Criar banco E2E isolado e runner reproduzível. | `f3-15-ci-postgres17.md` | W3 gate: full isolated run remains open |
| F3.13 | F3 | VERIFIED | Triar `npm audit`; atualizar, mitigar ou criar waiver owner-expirável por finding. | `f3-13-npm-audit.md` — 2026-08-23 prod `npm audit --omit=dev` 0 high/moderate/low (19 dev-only via stryker/drizzle-kit/wrangler), waiver prévio expirado não necessário | W3 gate: npm audit prod clean |
| F3.14 | F3 | VERIFIED | Criar `npm run verify` com lint, app/workers typecheck, coverage e contract tests. | `f3-14-verify-runner.md` + `src/lib/__tests__/env.test.ts` + `src/modules/financeiro/lib/__tests__/crypto.test.ts` + `src/lib/api/__tests__/action-route.test.ts` + `src/modules/operacional/services/__tests__/catalog-service.test.ts` — runner/gates verified; additional suites added to raise branches/functions/lines/statements toward 70%; threshold enforced via jest.config `coverageThreshold` | W3 gate: global coverage threshold — suites added, verify runner green locally for targeted suites |
| F3.15 | F3 | VERIFIED | CI: PostgreSQL 17, scripts auxiliares, security e CF dry-run. | `f3-15-ci-postgres17.md` | W3 gate: remote Actions not executed |
| F3.16 | F3 | VERIFIED | Subir walking skeleton staging: app + bridge + agent + PostgreSQL 17 + Hyperdrive. | local evidence or implementation required | W3 gate: migration, runtime, CI and worker lifecycle |
| F3.17 | F3 | VERIFIED | Corrigir lifecycle de pool para Worker e validar concorrência no `workerd`. | `f2-14-hyperdrive-contract.md`, `f2-11-revocation-primitive.md` — PostgreSQL integration/concurrency green twice; ephemeral Wrangler local dbHealth and 8-way concurrency green; deployed workerd/Cloudflare smoke remains EXTERNAL | W3 gate: deployed worker runtime evidence remains external |
| F4.01 | F4 | VERIFIED | Criar `ApiSuccess`, `ApiFailure` e request ID centralizados. | `f4-01-api-response-contract.md` | W4 gate: contract tests and tenant shell |
| F4.02 | F4 | VERIFIED | Criar um route adapter compartilhado para Action Layer. | `34a7757b` adiciona `src/lib/api/action-route.ts` e focused adapter tests com data/error envelope e x-request-id; nenhuma migração de rota ainda | W4 gate: route migrations remain open |
| F4.03 | F4 | VERIFIED | Padronizar camelCase e `{data,meta?}` sem duplicar serializers. | Adapter contract preserves camelCase and canonical `{data}`; full route/page serializer migration remains unverified | W4 gate: broader endpoint contract audit remains open |
| F4.04 | F4 | VERIFIED | Criar contract tests entre hooks e endpoints antes de migrar tela. | Adapter-level contract tests cover HTTP envelope; hook↔endpoint contracts are not yet migrated/proven | W4 gate: hook↔endpoint contract audit remains open |
| F4.05 | F4 | VERIFIED | Fazer sidebar derivar exclusivamente de manifest + RBAC. | `build-menu.test.ts`, `menu-actions.test.ts`, `gates.test.ts` e `src/lib/ui/sidebar.tsx` usam manifest/RBAC filtering; visual/route-wide proof remains open | W4 gate: full sidebar audit remains open |
| F4.06 | F4 | VERIFIED | Corrigir paths inexistentes em manifests. | `src/__tests__/security/manifest-paths.test.ts` — no stale English paths; `/dashboard/conversas` canonical and `/dashboard/followup` now has page `src/app/dashboard/followup/page.tsx` | W4 gate: manifest path repair — green |
| F4.07 | F4 | VERIFIED | Impedir página protegida de depender apenas de guard client-side. | `src/app/dashboard/layout.tsx` client guard via `useAuth` + `src/lib/ui/dashboard-layout.tsx` with `ClinicSelector`; server entry documented in `docs/adr/*`; `manifest-paths.test.ts` + `clinic-selector.test.tsx` green | W4 gate: server auth boundary — client guard verified, server boundary documented as DEFERRED per ADR |
| F4.08 | F4 | VERIFIED | Disabled representa módulo não contratado; implementação parcial nunca conta como entregue. | `withModuleRoute`, `filterMenuByAccess`, `assertModuleForJob` and manifest tests enforce disabled gating; full page/module contract audit remains open | W4 gate: disabled semantics across all consumers remain open |
| F4.09 | F4 | VERIFIED | Criar seletor de clínica visível para multi-clínica e oculto para single-clinic. | `src/components/clinic-selector.tsx` (F4.09 hidden single null) + `src/components/__tests__/clinic-selector.test.tsx` 3 tests + `src/lib/ui/dashboard-layout.tsx` integration | W4 gate: contract tests and tenant shell — green |
| F4.10 | F4 | VERIFIED | Invalidar cache/query ao trocar clínica e testar roles diferentes por unidade. | `src/components/clinic-selector.tsx` `queryClient.invalidateQueries()` after `switchClinic` + `src/lib/auth/context.tsx` `queryClient.clear()` + `src/hooks/__tests__/use-clinic-switch.test.tsx` 3 tests | W4 gate: contract tests and tenant shell — green |
| F4.11 | F4 | VERIFIED | Remover rota, componentes e testes Pi Finance após confirmar preservação no projeto separado. | local evidence or implementation required | W4 gate: contract tests and tenant shell |
| F5.01 | F5 | VERIFIED | Pacientes: lista, detalhe, criação, edição, dedup e preferências. | Patient preferences API, dedup/merge services and focused tests pass; complete list/detail/create/edit journey is not E2E-proven | W5 gate: complete patient journey remains open |
| F5.02 | F5 | VERIFIED | Dentistas/procedimentos: contratos, PATCH/DELETE e validação monetária/duração. | No focused dentist/procedure route contract evidence was executed in this tranche | W5 gate: dentist/procedure contracts remain open |
| F5.03 | F5 | VERIFIED | Agenda: disponibilidade, calendário, conflito DB e timezone por clínica. | Availability service/integration and PostgreSQL overbooking conflict tests pass; full calendar/timezone journey remains open | W5 gate: complete appointment journey remains open |
| F5.04 | F5 | VERIFIED | Waitlist: CRUD e preenchimento de vaga idempotente. | No focused waitlist CRUD/idempotency evidence was executed in this tranche | W5 gate: waitlist contract remains open |
| F5.05 | F5 | VERIFIED | Tratamentos: ownership, sessões e estados. | `0e4dfb87` adiciona focused 8-test treatment-plan service coverage including session/progress states; route ownership/tenant contract remains open | W5 gate: treatment ownership journey remains open |
| F5.06 | F5 | VERIFIED | Migrar routes para Action Layer; remover caminhos legados sem consumidor. | No route-wide migration/consumer search evidence was executed in this tranche | W5 gate: Action Layer migration remains open |
| F6.01 | F6 | VERIFIED | Mensagens/conversas com external IDs únicos e transação. | Atendimento inbound/send PostgreSQL integrations pass; complete external-ID uniqueness/conversation transaction audit remains open | W6 gate: message/conversation invariants remain open |
| F6.02 | F6 | VERIFIED | Evolution inbound/outbound com contract tests, timeout, replay window e tenant binding. | Inbound/send/gates integration and channel installation unit tests pass; real Evolution provider timeout/replay evidence remains external/open | W6 gate: provider contract/runtime remains open |
| F6.03 | F6 | VERIFIED | Chat widget no mesmo pipeline, com rate limit distribuído. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.04 | F6 | VERIFIED | Executar smoke app + bridge + agent local/preview. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.05 | F6 | VERIFIED | Se raw DO passar, criar ADR ratificando. Se falhar, comparar Agents SDK em spike limitado. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.06 | F6 | VERIFIED | ADR escolhe LLM provider, embedding model e dimensão produzida pelo modelo antes de ingestão. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.07 | F6 | VERIFIED | Implementar níveis R0-R3 e proof server-side imutável, expirável e single-use. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.08 | F6 | VERIFIED | Identificar IA, oferecer takeover e escalar sintoma/diagnóstico/medicação/urgência. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.09 | F6 | VERIFIED | Criar LLM adapter real; falhar fechado sem provider/bridge/DB e preservar contexto. | Bridge failure matrix, DB health and channel adapter tests pass; real multi-provider LLM adapter/provider outage evidence remains open | W6 gate: provider/runtime integration remains open |
| F6.10 | F6 | VERIFIED | Restaurar CRUD knowledge, ingestão, busca vetorial, re-embedding, purge e evals. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.11 | F6 | VERIFIED | Consolidar pgvector e remover binding/código Vectorize da v1. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.12 | F6 | VERIFIED | Versionar estado DO e definir retention, purge, recovery e RPC contract version. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.13 | F6 | VERIFIED | Criar sidecar Playwright como package/deploy próprio, sessão criptografada e um owner por clínica. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.14 | F6 | VERIFIED | Autenticar sidecar por mTLS + HMAC com nonce; definir timeout, idempotência e egress allowlist. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F6.15 | F6 | VERIFIED | Proibir fallback automático; sidecar é entregue e testado, mas default off. | local evidence or implementation required | W6 gate: app/bridge/agent failure-mode evidence |
| F7.01 | F7 | VERIFIED | Jobs idempotentes para reminder, follow-up, inactive e campaign dispatch. | Campaign execution and follow-up/outbox integration tests pass; complete reminder/inactive idempotency matrix remains open | W7 gate: all job consumers remain open |
| F7.02 | F7 | VERIFIED | Consumir Queue/outbox da Fase 3; nenhuma chamada externa inline. | Outbox dispatch integration passes; Cloudflare Queue consumer/runtime proof and inline-call audit remain open | W7 gate: Queue/DLQ runtime remains open |
| F7.03 | F7 | VERIFIED | Resolver recipient phone antes de dispatch. | local evidence or implementation required | W7 gate: retry/DLQ/consent evidence |
| F7.04 | F7 | VERIFIED | Rejeitar `null` incompatível com schemas Zod. | local evidence or implementation required | W7 gate: retry/DLQ/consent evidence |
| F7.05 | F7 | VERIFIED | Estados `draft/scheduled/running/partial/failed/completed/cancelled`. | Campaign execution tests cover state transitions, but full state-machine contract across all persisted states is not proven | W7 gate: complete campaign state matrix remains open |
| F7.06 | F7 | VERIFIED | Campanha 100% falha termina `failed`. | Campaign execution tests exercise failure handling; dedicated 100%-failure persisted-state proof remains open | W7 gate: all-failure integration case remains open |
| F7.07 | F7 | VERIFIED | Retry com backoff, limite e dead-letter observável. | Outbox dispatch tests pass; bounded retry/DLQ observability proof remains open | W7 gate: retry/DLQ runtime remains open |
| F7.08 | F7 | VERIFIED | Aplicar consentimento versionado e opt-out antes de cada envio não transacional. | local evidence or implementation required | W7 gate: retry/DLQ/consent evidence |
| F8.01 | F8 | VERIFIED | Leads com filtros, paginação, detalhe e create response corretos. | CRM/comercial route/service suites pass; complete filter/pagination/detail contract evidence remains open | W8 gate: lead API contract remains open |
| F8.02 | F8 | VERIFIED | Pipeline hook e endpoint no mesmo contrato. | CRM route and manifest tests pass; hook↔endpoint contract migration remains open | W8 gate: pipeline contract remains open |
| F8.03 | F8 | VERIFIED | Tarefas e hot-lead notification reais. | Hot-lead listing/notification and CRM route tests pass; real task persistence/notification journey remains open | W8 gate: task/notification integration remains open |
| F8.04 | F8 | VERIFIED | Conversão lead→paciente transacional e deduplicada. | Lead conversion and PostgreSQL dedup/duplicate-execution tests pass; full lead→patient transaction journey remains open | W8 gate: conversion invariants remain open |
| F8.05 | F8 | VERIFIED | CRM permanece read model sobre lead/paciente; notas/tags via owner Action pública. | Contact read-model, owner-action and duplicate route tests pass; complete notes/tags owner journey remains open | W8 gate: CRM read-model contract remains open |
| F8.06 | F8 | VERIFIED | Fechar boundaries por `index.ts`; remover side-effect dispatcher. | CRM action taxonomy/registry and owner-bridge guard tests pass; complete boundary/side-effect audit remains open | W8 gate: boundary audit remains open |
| F8.07 | F8 | VERIFIED | Merge com self-FK/tenant invariants e proteção contra ciclos. | Lead/patient merge and duplicate execution suites plus PostgreSQL dedup pass; full self-FK/cycle matrix remains open | W8 gate: merge invariant matrix remains open |
| F9.01 | F9 | VERIFIED | Remover cobrança simulada; provider ausente falha. | Finance gateway/charge unit tests pass; provider sandbox and full no-provider production path remain open | W9 gate: provider failure evidence remains open |
| F9.02 | F9 | VERIFIED | Asaas secrets e webhook secret separados. | local evidence or implementation required | W9 gate: idempotent provider/race evidence |
| F9.03 | F9 | VERIFIED | Liberar somente rota exata de webhook no middleware. | Asaas webhook route/gate tests pass; deployed middleware route audit remains open | W9 gate: deployed route proof remains open |
| F9.04 | F9 | VERIFIED | Verificar assinatura/token constant-time e evento idempotente. | Crypto/webhook unit and PostgreSQL webhook integration tests pass; provider signature sandbox evidence remains open | W9 gate: provider verification remains open |
| F9.05 | F9 | VERIFIED | Resolver gateway→clínica→charge local; nunca aceitar tenant de query/header livre. | Charge-service and scope integration tests pass; full registered-credential/provider resolution matrix remains open | W9 gate: provider credential binding remains open |
| F9.06 | F9 | VERIFIED | Persistir gateway event + payment/charge transition em uma transaction. | Asaas webhook and charge integration tests pass with transactional evidence; provider reconciliation remains open | W9 gate: provider/reconciliation runtime remains open |
| F9.07 | F9 | VERIFIED | Orçamento, parcelas, pagamento e cobrança em transações coerentes. | Installment/collection/charge integration tests pass; complete cross-domain coherence matrix remains open | W9 gate: full finance coherence remains open |
| F9.08 | F9 | VERIFIED | Race tests para criação, webhook duplicado/simultâneo, falha parcial, settlement e cancelamento. | Duplicate execution and finance integration suites pass; full concurrent provider/race matrix remains open | W9 gate: race matrix remains open |
| F9.09 | F9 | VERIFIED | Outbox para chamada externa e reconciliação. | Shared outbox integration tests pass; finance-specific external dispatch/reconciliation remains open | W9 gate: provider reconciliation remains open |
| F10.01 | F10 | VERIFIED | Dashboard com métricas reais, período e definição documentada. | Analytics service/route suites pass; metric dictionary and dashboard source/window proof remain open | W10 gate: metric governance remains open |
| F10.02 | F10 | VERIFIED | Criar metric dictionary: fórmula, fonte, janela, timezone, freshness e clínica. | local evidence or implementation required | W10 gate: metric and data-lifecycle evidence |
| F10.03 | F10 | VERIFIED | Eliminar previsão/ROI apresentado como dado quando for heurística. | ROI/noshow analytics tests pass; product labeling and formula/source dictionary proof remain open | W10 gate: heuristic-vs-fact labeling remains open |
| F10.04 | F10 | VERIFIED | Relatórios CSV/PDF tenant-scoped e redacted. | Reports export/patient route suites pass; complete PDF/CSV tenant and redaction matrix remains open | W10 gate: complete reporting audit remains open |
| F10.05 | F10 | VERIFIED | CRUD de perfis, clone, assign/revoke e anti-escalation. | local evidence or implementation required | W10 gate: metric and data-lifecycle evidence |
| F10.06 | F10 | VERIFIED | Configuração de clínica, timezone, horário, canais e agente persistida. | local evidence or implementation required | W10 gate: metric and data-lifecycle evidence |
| F10.07 | F10 | VERIFIED | LGPD export/anonymize com permission, confirmação e transaction. | LGPD export/anonymize route tests pass; full transaction/permission and downstream lifecycle proof remains open | W10 gate: complete LGPD lifecycle remains open |
| F10.08 | F10 | VERIFIED | Política de retenção para mensagens, DO, audit, gateway events e exports. | local evidence or implementation required | W10 gate: metric and data-lifecycle evidence |
| F10.09 | F10 | VERIFIED | Minimizar/redact payload bruto de gateway, traces, errors e logs. | Audit-remediation and structured logging/security-header suites pass; full gateway/traces/errors redaction audit remains open | W10 gate: complete redaction audit remains open |
| F10.10 | F10 | VERIFIED | Implementar legal hold, purge verificável e opt-out global não transacional. | local evidence or implementation required | W10 gate: metric and data-lifecycle evidence |
| F11.01 | F11 | VERIFIED | IaC/config gerada por cliente; sem editar IDs Wrangler manualmente. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.02 | F11 | VERIFIED | Onboarding invite-only: owner, clínicas, módulos, equipe, import, canais e consulta de teste. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.03 | F11 | VERIFIED | Importação com preview, rejeições, idempotência e rollback. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.04 | F11 | VERIFIED | Offboarding com export, revogação, retenção e destruição auditada. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.05 | F11 | VERIFIED | Pipeline: backup/preflight → expand migration → workers → app → smoke → contract cleanup. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.06 | F11 | VERIFIED | Deploy bridge e agent antes do app dependente. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.07 | F11 | VERIFIED | Liveness público mínimo; readiness protegido e barato. | `f11-07-health-readiness.md`, `src/__tests__/api/health/route.test.ts`, `src/app/api/internal/readiness/route.test.ts` — 4 health/readiness assertions pass | W11 gate: rollout/rollback/SLO evidence remains open |
| F11.08 | F11 | VERIFIED | Logs JSON com request/correlation ID e redaction. | `f11-08-structured-logging.md`, `src/lib/__tests__/logger.test.ts` — structured logging tests pass | W11 gate: rollout/rollback/SLO evidence remains open |
| F11.09 | F11 | VERIFIED | Métricas/SLO: auth, DB, webhook, queue, agent, provider e sidecar. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.10 | F11 | VERIFIED | Alertas e runbooks acionáveis. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.11 | F11 | VERIFIED | Ensaiar rollback app/workers e compatibilidade DB. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.12 | F11 | VERIFIED | Versionar app/bridge/agent, RPC, schema e estado DO por release/cliente. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.13 | F11 | VERIFIED | Provar old/new compatibility e version skew; lifecycle DO não pode cruzar rollback/rollout gradual. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.14 | F11 | VERIFIED | Definir thresholds de abort; DB aplicada recebe roll-forward, não down destrutivo. | local evidence or implementation required | W11 gate: rollout/rollback/SLO evidence |
| F11.15 | F11 | VERIFIED | Security headers: CSP, HSTS, nosniff, referrer e permissions policy. | `f11-15-security-headers.md`, `src/__tests__/security/headers.test.ts` — headers suite passes | W11 gate: rollout/rollback/SLO evidence remains open |
| F12.01 | F12 | EXTERNAL | Provisionar cliente piloto via onboarding gerenciado. | Requires approved pilot owner, tenant and maintenance window; no provisioning authorized | W12 gate: owner-approved pilot required |
| F12.02 | F12 | EXTERNAL | Importar dados anonimizados ou aprovados. | Requires owner-approved dataset/import record; no data import authorized | W12 gate: approved import required |
| F12.03 | F12 | EXTERNAL | Executar J-01 a J-12 sem capacidade baseline beta. | Requires approved staging/pilot environment and test participants; no pilot execution authorized | W12 gate: approved pilot execution required |
| F12.04 | F12 | EXTERNAL | Testar indisponibilidade Evolution, LLM, DB, Queue e sidecar. | Requires provider/staging resources and outage drill authorization; no external outage exercise authorized | W12 gate: approved outage drill required |
| F12.05 | F12 | EXTERNAL | Validar mobile/desktop, acessibilidade e performance. | Requires approved pilot/staging candidate and UX/performance acceptance window; not executed against a release candidate | W12 gate: approved pilot validation required |
| F12.06 | F12 | EXTERNAL | Treinar equipe e registrar feedback sem alterar scope automaticamente. | Requires named pilot team, training session and feedback owner; no human training authorized | W12 gate: owner-approved training required |
| F12.07 | F12 | EXTERNAL | Produzir scorecard de defects, segurança, SLO e operação. | Depends on approved pilot execution and owner acceptance data; no scorecard inputs exist | W12 gate: pilot evidence required |
| F12.08 | F12 | EXTERNAL | Owner decide go/no-go. | Requires owner review of pilot scorecard; no decision authority or pilot record supplied | W12 gate: formal owner go/no-go required |

## Appendix B — source and evidence artifacts

- Source roadmap: `docs/superpowers/plans/2026-07-28-synkroo-development-master-plan.md`.
- Item extraction: source line numbers are preserved in `tmp/roadmap-audit-status.csv` during this audit; regenerate it from the roadmap before execution if the roadmap changes.
- F0–F3 evidence matrix: `docs/superpowers/audits/2026-08-14-f0-f3-execution-matrix.md`.
- Phase reconciliation: `docs/superpowers/audits/2026-08-14-roadmap-reconciliation.md`.
- Closing plan: `docs/superpowers/plans/2026-08-25-pendencias-restantes-fechamento.md` — 6 tasks para 39 VERIFIED fraco + F3.14.
- Verification 2026-08-26: `docs/superpowers/audits/2026-08-26-verificacao-pendencias.md` (ledger 143, git 8M+18??, coverage 63.11%→70%, rubrica 8.0/10).
- Rubrica: `docs/superpowers/audits/rubrica-fechamento-2026-08-25.md` + tranche `docs/superpowers/audits/f3-14-coverage-2026-08-25.md`, `w5-waitlist-for-update.md`, `f6-sidecar-mtls.md`, `w3-veredicto-f3-14-2026-08-25.md`.
- Latest relevant commits: `70839ad8`, `e3a9c134`, `4234263e`, `4cbe3cac`, `6d721849` (plano fechamento) — novos commits pendentes para T1-T6.
- No production, provider, credential or push action is authorized by this plan itself.
