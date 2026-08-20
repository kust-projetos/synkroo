# Synkroo Roadmap 143 Wave 4 Business and LGPD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar F8–F10 com CRM transacional, financeiro Asaas real/fail-closed, métricas governadas e ciclo LGPD completo.

**Architecture:** CRM permanece read model; pacientes/leads mantêm ownership. Financeiro resolve tenant apenas por gateway registrado e usa transaction + outbox/reconciliação. Analytics usa metric dictionary; LGPD aplica permission, confirmação, legal hold, retention e purge auditável.

**Tech Stack:** Next.js Actions/API, Drizzle/PostgreSQL, Asaas adapter, Queue/outbox, Recharts/exports, Jest/Playwright.

**Agent Orchestration:** Supervisor-Workers — CRM e metric dictionary paralelos; finance serial; LGPD após contratos de dados.

---

## Ownership

| Goal | IDs | Dependências |
|---|---|---|
| O4-G01 leads-pipeline | F8.01–F8.03 | Gate 2 |
| O4-G02 conversion-readmodel | F8.04–F8.06 | O4-G01/O2-G05 |
| O4-G03 crm-merge | F8.07 | O4-G02 |
| O4-G04 finance-provider | F9.01–F9.05 | Gate 1/O3-G09 |
| O4-G05 finance-ledger-races | F9.06–F9.09 | O4-G04/O4-G02 |
| O4-G06 metric-governance | F10.01–F10.03 | Gate 2 |
| O4-G07 reports-settings-profiles | F10.04–F10.06 | O4-G06/O2-G03 |
| O4-G08 lgpd-lifecycle | F10.07–F10.10 | O4-G02/O4-G05/O4-G07/O3-G10 |

## Task 1: O4-G01 — Lead contracts, pipeline, tasks and notifications

**Files:**
- Modify: `src/app/api/leads/`
- Modify: `src/services/leads/` and commercial module
- Modify: `src/hooks/use-kanban.ts`
- Modify: task/notification services and schema
- Modify: `e2e/api/leads-api.spec.ts`
- Modify: `e2e/leads.spec.ts` and `e2e/crm/pipeline.spec.ts`
- Create: `docs/superpowers/audits/o4-g01-leads-pipeline.md`

- [ ] **Step 1: RED API/hook contracts**

Test filters, cursor/page/limit, detail, create envelope, invalid filter, clinic/module/permission, and hook request/response equality. Add persisted task create/update/complete and hot-lead notification dedup cases.

- [ ] **Step 2: Run RED**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/api/leads-api.spec.ts e2e/leads.spec.ts e2e/crm/pipeline.spec.ts
```

- [ ] **Step 3: Implement/migrate vertical slice**

Route uses Action adapter; service owns scoring/status; repository scopes clinic; pipeline hook consumes canonical envelope. Tasks/notifications persist; no in-memory success response.

- [ ] **Step 4: GREEN and concurrency**

Add duplicate lead ingestion and simultaneous task completion. Expected: one lead/notification effect and stable task state.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/leads src/services/leads src/hooks/use-kanban.ts src/modules e2e/api/leads-api.spec.ts e2e/leads.spec.ts e2e/crm/pipeline.spec.ts docs/superpowers/audits/o4-g01-leads-pipeline.md
git commit -m "feat(leads): close pipeline and task contracts"
```

## Task 2: O4-G02 — Transactional conversion and CRM read model

**Files:**
- Modify: `src/modules/crm/`
- Modify: lead conversion Action/service/repository
- Modify: patient dedup service
- Modify: contact notes/tags routes/Actions
- Modify: CRM integration tests
- Create: `docs/superpowers/audits/o4-g02-conversion-readmodel.md`

- [ ] **Step 1: RED conversion matrix**

Test new patient, existing normalized contact, duplicate simultaneous conversion, foreign clinic, rollback after patient insert and repeated request. Assert one patient link and coherent lead state.

- [ ] **Step 2: RED read-model/boundary tests**

CRM cannot mutate patient/lead ownership directly. Notes/tags use public owner Actions. `index.ts` is the module boundary; importing internal dispatcher or triggering side effects on import fails architecture test.

- [ ] **Step 3: Run RED**

```bash
npm test -- --runInBand src/modules/crm
npm run test:integration:run
```

- [ ] **Step 4: Implement one transaction and public interfaces**

Conversion locks/dedups normalized contact, creates/links patient, updates lead and emits outbox event in one transaction. CRM projections update asynchronously/idempotently.

- [ ] **Step 5: GREEN twice and commit**

```bash
npm test -- --runInBand src/modules/crm
npm run test:integration:run
npm run test:integration:run
git add src/modules/crm src/services src/app/api docs/superpowers/audits/o4-g02-conversion-readmodel.md
git commit -m "feat(crm): enforce conversion and read model boundaries"
```

Stage only conversion/contact API and service paths.

## Task 3: O4-G03 — Tenant-safe merge and cycle protection

**Files:**
- Modify: CRM dedup/merge services and repositories
- Modify: patient/lead self-FK schema and migration
- Modify: merge integration tests
- Create: `docs/superpowers/audits/o4-g03-crm-merge.md`

- [ ] **Step 1: RED invariant matrix**

Self merge, cross-clinic winner/loser, loser already redirected, winner redirect chain, cycle A→B→A, concurrent approval/execution, drift below threshold and replay.

- [ ] **Step 2: Run RED**

```bash
npm test -- --runInBand src/modules/crm
npm run test:integration:run
```

- [ ] **Step 3: Implement transactional merge**

Resolve canonical winner under clinic lock, reject cycles, move allowed relationships, retain loser redirect, clear unique normalized fields and persist audit/outbox once.

- [ ] **Step 4: Adversarial GREEN twice**

Expected: one merge effect, no orphan/self-FK/cycle and deterministic replay result.

- [ ] **Step 5: Commit**

```bash
git add src/modules/crm src/lib/db docs/superpowers/audits/o4-g03-crm-merge.md
git commit -m "feat(crm): enforce merge tenant invariants"
```

## Task 4: O4-G04 — Real Asaas provider boundary

**Files:**
- Modify: `src/modules/financeiro/gateways/providers/asaas/mapper.ts`
- Modify: finance gateway adapter/config services
- Modify: Asaas webhook route/middleware/auth
- Modify: finance env validation
- Modify: provider contract tests
- Create: `docs/superpowers/audits/o4-g04-finance-provider.md`

- [ ] **Step 1: RED mapper contracts**

Use sanitized Asaas fixtures for create-charge success/error and webhook event types. Assert money precision, due date, external IDs, payment URL/PIX nullability, status mapping and rejection of unknown/invalid payload.

- [ ] **Step 2: RED security/provider cases**

Missing provider fails without fake URL/PIX/ID; API key and webhook secret are different variables; middleware allowlists exact route; token comparison is constant-time; query/header cannot choose clinic.

- [ ] **Step 3: Run RED**

```bash
npm test -- --runInBand src/modules/financeiro
npm run test:security:integration
```

Expected: current mapper throws and routing-rule update gaps fail.

- [ ] **Step 4: Implement mapper and config update**

Zod validates provider payload. Mapper is pure. Gateway config update is tenant-scoped, validates provider capability and never logs secrets. Registered credential/channel resolves clinic and local charge.

- [ ] **Step 5: GREEN and no-simulation scan**

```bash
npm test -- --runInBand src/modules/financeiro
npm run test:security:integration
```

Search production finance code for fake URLs/PIX/external IDs and `not yet implemented`; expected zero executable occurrence.

- [ ] **Step 6: Emit gate O4-X01**

Asaas sandbox gate includes account/secret names, webhook registration, exact route, create/cancel/pay fixtures, timeout/signature probes, cost limits, cleanup and receipts.

- [ ] **Step 7: Commit**

```bash
git add src/modules/financeiro src/app/api src/middleware.ts src/lib/env.ts docs/superpowers/audits/o4-g04-finance-provider.md
git commit -m "feat(finance): implement fail-closed Asaas boundary"
```

Stage only finance API/middleware/env paths.

## Task 5: O4-G05 — Finance transaction, race and reconciliation

**Files:**
- Modify: finance charge/payment/installment/budget services and repositories
- Modify: gateway event schema/repository
- Modify: finance outbox/reconciliation worker
- Create: finance PostgreSQL race tests
- Create: `docs/superpowers/audits/o4-g05-finance-races.md`

- [ ] **Step 1: RED coherence matrix**

Budget acceptance creates coherent installments; charge amount is server-derived; payment/settlement updates installment and budget totals; cancellation rules preserve ledger; partial provider failure creates reconcilable state.

- [ ] **Step 2: RED race matrix**

Concurrent charge creation, duplicate/simultaneous webhook, webhook before local response, settlement vs cancellation, crash after provider success and reconciliation replay.

- [ ] **Step 3: Run RED**

```bash
npm run test:integration:run
```

Expected: every missing race/failure case is reproducibly red using barriers, not timing sleeps.

- [ ] **Step 4: Implement transaction/outbox authority**

Persist intent/outbox before external call. Webhook transaction inserts unique provider event and transitions local charge/payment once. Reconciler resolves ambiguous provider outcomes idempotently.

- [ ] **Step 5: GREEN repeatedly**

```bash
npm run test:integration:run
npm run test:integration:run
npm run test:integration:run
```

Expected: all three pass with identical final ledger assertions.

- [ ] **Step 6: Run Asaas sandbox matrix after O4-X01**

Retain provider request/event IDs, not payload secrets. Prove create, duplicate webhook, settlement, cancellation and reconciliation.

- [ ] **Step 7: Commit**

```bash
git add src/modules/financeiro src/lib/db src/workers docs/superpowers/audits/o4-g05-finance-races.md
git commit -m "feat(finance): make provider ledger race safe"
```

## Task 6: O4-G06 — Metric dictionary and truthful analytics

**Files:**
- Create: `docs/product/metric-dictionary.md`
- Modify: analytics services/routes
- Modify: dashboard metric cards/charts
- Modify: analytics contract tests
- Create: `docs/superpowers/audits/o4-g06-metric-governance.md`

- [ ] **Step 1: Define each displayed metric**

Dictionary rows require key, user label, formula, tables/fields, filters, clinic scope, period/window, timezone, freshness, empty-data behavior, owner and whether factual/heuristic.

- [ ] **Step 2: RED formula contracts**

Use fixed DB fixtures for revenue, appointment/no-show, lead conversion, campaign and ROI. Test timezone boundary, stale data and foreign clinic.

- [ ] **Step 3: Run RED**

```bash
npm test -- --runInBand src/app/api/analytics src/services/analytics
npm run test:integration:run
```

- [ ] **Step 4: Implement dictionary-backed queries**

UI displays period/freshness and labels heuristic predictions explicitly. Remove guessed ROI or present it only with formula/source/assumptions.

- [ ] **Step 5: GREEN and visual E2E**

```bash
npm test -- --runInBand src/app/api/analytics src/services/analytics
npm run test:integration:run
npm run test:e2e:production -- e2e/analytics/charts.spec.ts e2e/dashboard/overview.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add docs/product/metric-dictionary.md src/app/api/analytics src/services/analytics src/app/dashboard e2e/analytics/charts.spec.ts e2e/dashboard/overview.spec.ts docs/superpowers/audits/o4-g06-metric-governance.md
git commit -m "feat(analytics): govern metric definitions"
```

Stage only dashboard files that consume governed metrics.

## Task 7: O4-G07 — Reports, profiles and persisted clinic settings

**Files:**
- Modify: `src/services/api-handlers/reports/export.ts`
- Modify: report routes/tests
- Create/modify: access profile CRUD/clone/assign/revoke Actions
- Modify: clinic settings schema/service/routes/UI
- Modify: `e2e/settings.spec.ts` and report tests
- Create: `docs/superpowers/audits/o4-g07-reports-settings.md`

- [ ] **Step 1: RED report matrix**

CSV/PDF for foreign clinic rejected; permission applied; PII redaction by role; period/timezone shown; formula/source matches metric dictionary; formula injection escaped in CSV.

- [ ] **Step 2: RED profile anti-escalation**

Creator cannot grant permission/module they lack; clone preserves allowed set; assign/revoke increments session version; cross-clinic profile rejected.

- [ ] **Step 3: RED settings contract**

Persist timezone, business hours, channels and agent config; validate IANA timezone/hours; clinic switch reads active settings; hard-coded IA timezone is removed.

- [ ] **Step 4: Implement and GREEN**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/settings.spec.ts e2e/settings/settings.spec.ts
```

Expected: reports/profile/settings journeys pass and session revocation regression remains green.

- [ ] **Step 5: Commit**

```bash
git add src/services/api-handlers/reports src/app/api src/modules/core src/lib/db src/app/dashboard e2e/settings.spec.ts e2e/settings docs/superpowers/audits/o4-g07-reports-settings.md
git commit -m "feat(management): secure reports profiles and settings"
```

Stage only report/profile/settings paths.

## Task 8: O4-G08 — LGPD export, anonymization, retention and legal hold

**Files:**
- Modify: LGPD routes/services/components
- Modify: audit/gateway/log redaction utilities
- Create: retention policy and purge worker/service
- Modify: message/DO/audit/gateway/export schema as required
- Create: LGPD PostgreSQL integration/fault tests
- Create: `docs/policies/data-retention.md`
- Create: `docs/superpowers/audits/o4-g08-lgpd-lifecycle.md`

- [ ] **Step 1: RED authorization/confirmation tests**

Export/anonymize require module+permission, active clinic, explicit immutable confirmation and request ID. Replay/concurrent confirmation applies once. Foreign clinic and missing permission produce zero mutation.

- [ ] **Step 2: RED transaction/failure tests**

Inject failure after each anonymization stage; assert rollback. Export is encrypted/expiring, redacted and audit-minimal. Gateway/traces/errors/logs never retain forbidden raw PII.

- [ ] **Step 3: RED retention/legal-hold/purge tests**

Policy covers messages, DO, audit, gateway events and exports. Legal hold blocks incompatible purge. Purge is tenant-scoped, idempotent and verifiable. Global opt-out suppresses campaign/follow-up/IA before dispatch.

- [ ] **Step 4: Implement lifecycle**

Use explicit state machine for request→confirm→execute→receipt. Anonymization transaction preserves legally required minimal audit. Purge worker records counts/checksums without PII.

- [ ] **Step 5: GREEN and adversarial review**

```bash
npm run test:integration:run
npm run test:security -- --runInBand
npm run test:e2e:production -- e2e/crm/lgpd-consent.spec.ts
```

Review LGPD minimization, legal hold authority, export access/expiry and downstream propagation.

- [ ] **Step 6: Emit legal decision gate O4-X02**

Owner/legal reviewer confirms retention periods and legal bases. Receipt records policy version/approver/date, not sensitive legal data.

- [ ] **Step 7: Commit**

```bash
git add src docs/policies/data-retention.md docs/superpowers/audits/o4-g08-lgpd-lifecycle.md e2e/crm/lgpd-consent.spec.ts
git commit -m "feat(lgpd): enforce data lifecycle and legal hold"
```

Replace broad `git add src` with exact LGPD/redaction/retention paths.

## Task 9: Run Gate 4 and journeys

**Files:**
- Modify: `docs/superpowers/audits/roadmap-143-ledger.json`
- Modify: `docs/goals/roadmap-143-resume.md`
- Create: `docs/superpowers/audits/o4-business-lgpd-gate.md`
- Create/modify: journey specs for J-06, J-08 and J-09

- [ ] **Step 1: Run J-06**

Lead enters, dedups, moves pipeline, converts once, creates budget/installments, creates real sandbox charge and reconciles provider event. Duplicate/failure paths remain coherent.

- [ ] **Step 2: Run J-08**

Authorized owner exports and anonymizes; unauthorized/legal-hold paths fail; purge/receipt prove lifecycle.

- [ ] **Step 3: Run J-09**

Metrics match fixture dictionary by clinic/period/timezone; heuristic labels and freshness are visible.

- [ ] **Step 4: Run wave gate**

```bash
npm run roadmap:check
npm run verify
npm run test:integration:run
npm run test:security -- --runInBand
npm run build
npm run test:e2e:production
```

Expected: all exit 0 and all 26 F8–F10 IDs have nominal evidence plus required sandbox/legal receipts.

- [ ] **Step 5: Independent review and score**

Review transaction/races, tenant binding, money precision, redaction, legal hold, opt-out and metric truth. Zero blocker/high; every goal ≥9/10.

- [ ] **Step 6: Commit gate**

```bash
git add docs/superpowers/audits/roadmap-143-ledger.json docs/goals/roadmap-143-resume.md docs/superpowers/audits/o4-business-lgpd-gate.md e2e/journeys
git commit -m "docs(program): close business and lgpd wave gate"
```

Stage only J-06/J-08/J-09 files under `e2e/journeys`.
