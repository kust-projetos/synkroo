# Synkroo Roadmap 143 Wave 5 Release and Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar F11–F12 com provisioning gerenciado, pipeline seguro, observabilidade, rollback/version skew, piloto completo e decisão formal GO.

**Architecture:** Config por cliente é gerada de template validado. Deploy segue backup/preflight→expand DB→bridge/agent→app→smoke→cleanup. Observabilidade e abort thresholds govern rollout; piloto aprovado produz receipts e scorecard, nunca altera escopo silenciosamente.

**Tech Stack:** GitHub Actions, Wrangler/OpenNext, Cloudflare Workers/Hyperdrive/Queues/DO, PostgreSQL 17, Node scripts, Playwright, metrics/logging.

**Agent Orchestration:** Hierarchical — release lane serial; observers/read-only reviewers em paralelo; ações de piloto são gates humanos prontos.

---

## Ownership

| Goal | IDs | Dependências |
|---|---|---|
| O5-G01 client-iac | F11.01 | Gate 4 |
| O5-G02 lifecycle-ops | F11.02–F11.04 | O5-G01/O4-G08 |
| O5-G03 deploy-pipeline | F11.05–F11.06 | O5-G01/Gate 4 |
| O5-G04 health-security-regression | F11.07–F11.08, F11.15 | O5-G03 |
| O5-G05 observability | F11.09–F11.10 | O5-G03/O5-G04 |
| O5-G06 version-rollback | F11.11–F11.14 | O5-G03/O3-G07/O5-G05 |
| O5-G07 pilot-provision | F12.01–F12.02 | O5-G02/O5-G06 |
| O5-G08 pilot-validation | F12.03–F12.05 | O5-G07 |
| O5-G09 scorecard-go | F12.06–F12.08 | O5-G08 |

## Task 1: O5-G01 — Deterministic per-client infrastructure config

**Files:**
- Create: `infra/templates/wrangler.client.toml`
- Create: `scripts/generate-client-config.mjs`
- Create: `scripts/__tests__/generate-client-config.test.mjs`
- Modify: deployment documentation
- Create: `docs/superpowers/audits/o5-g01-client-iac.md`

- [ ] **Step 1: RED generator tests**

Tests require authenticated operator input, validated client slug/environment, dedicated app/bridge/agent names, binding names without secret values, deterministic output, no manually copied resource ID and refusal to overwrite without explicit flag.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/__tests__/generate-client-config.test.mjs
```

Expected: fail because generator does not exist.

- [ ] **Step 3: Implement import-safe dry-run generator**

Default prints a redacted diff. `--write` creates environment-specific config outside tracked secret files. Resource IDs are read from provisioning receipts/API output, never hand-edited in template.

- [ ] **Step 4: Run GREEN and dry-run**

```bash
node --test scripts/__tests__/generate-client-config.test.mjs
node scripts/generate-client-config.mjs --client pilot --environment staging
```

Expected: deterministic redacted config preview and zero file write.

- [ ] **Step 5: Commit**

```bash
git add infra/templates/wrangler.client.toml scripts/generate-client-config.mjs scripts/__tests__/generate-client-config.test.mjs docs/superpowers/audits/o5-g01-client-iac.md
git commit -m "feat(infra): generate dedicated client config"
```

## Task 2: O5-G02 — Managed onboarding, import and offboarding

**Files:**
- Create: `scripts/provision-client.mjs`
- Create: `scripts/import-client-data.mjs`
- Create: `scripts/offboard-client.mjs`
- Create: script unit/contract tests
- Modify: onboarding/import/offboarding runbooks
- Create: `docs/superpowers/audits/o5-g02-client-lifecycle.md`

- [ ] **Step 1: RED CLI contracts**

All scripts are import-safe, dry-run by default and require authenticated operator plus `--apply`. Tests reject partial config, public signup, unknown module, invalid row, replay, unapproved destruction and missing backup/retention receipt.

- [ ] **Step 2: RED onboarding state machine**

Provision order: dedicated resources→owner identity→clinics→RBAC/modules→team invites→approved import→channels→test appointment. Inject failure at each stage and prove resume/compensation.

- [ ] **Step 3: RED import contracts**

Preview reports accepted/rejected rows with reasons and no PII logs. Apply is idempotent and transaction/batch safe; replay does not duplicate. Rollback targets import batch.

- [ ] **Step 4: RED offboarding contracts**

Export, revoke sessions/credentials, enforce retention/legal hold, destroy only after explicit approval and record sanitized receipt.

- [ ] **Step 5: Implement and run GREEN**

```bash
node --test scripts/__tests__/provision-client.test.mjs scripts/__tests__/import-client-data.test.mjs scripts/__tests__/offboard-client.test.mjs
```

Expected: all dry-run/failure/resume/idempotency contracts pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/provision-client.mjs scripts/import-client-data.mjs scripts/offboard-client.mjs scripts/__tests__ docs/runbooks docs/superpowers/audits/o5-g02-client-lifecycle.md
git commit -m "feat(ops): add managed client lifecycle"
```

Stage only the three new script tests and their runbooks.

## Task 3: O5-G03 — Ordered deploy pipeline

**Files:**
- Create/modify: `.github/workflows/deploy.yml`
- Modify: deployment scripts and `wrangler.toml`
- Modify: `scripts/smoke-staging.mjs`
- Create: deploy contract tests
- Create: `docs/superpowers/audits/o5-g03-deploy-pipeline.md`

- [ ] **Step 1: RED pipeline-order test**

Parse workflow and require: approval/environment→backup receipt→DB preflight→expand migration→bridge→agent→app→smoke/readiness→contract cleanup. Bridge/agent must precede dependent app.

- [ ] **Step 2: RED failure/rollback tests**

A failure before DB apply stops safely. After expand migration, app rollback uses schema-compatible version or roll-forward; never destructive down migration. Failed worker/app smoke invokes recorded rollback.

- [ ] **Step 3: Implement workflow with concurrency lock**

One deployment per client/environment. Every job carries release/client/environment/version metadata and uses environment-scoped secrets.

- [ ] **Step 4: Run local contracts**

```bash
npm run test:release
npm run build
npm run build:cf
npx wrangler deploy --dry-run --config wrangler.toml
```

Expected: all pass and workflow-order test is green.

- [ ] **Step 5: Push PR and verify CI**

Expected: no deploy occurs on PR; release workflow requires configured environment/gate. Preserve workflow run/SHA.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy.yml scripts wrangler.toml docs/superpowers/audits/o5-g03-deploy-pipeline.md
git commit -m "ci(deploy): order safe worker and app rollout"
```

Stage only deploy/smoke contract scripts.

## Task 4: O5-G04 — Regress health, logging and security headers

**Files:**
- Modify only if regression found: health/readiness routes, logger and security headers
- Modify: associated tests
- Create: `docs/superpowers/audits/o5-g04-release-regression.md`

- [ ] **Step 1: Run recorded contracts**

```bash
npx jest src/__tests__/api/health/route.test.ts src/app/api/internal/readiness/route.test.ts src/lib/__tests__/logger.test.ts src/__tests__/security/headers.test.ts --runInBand
```

Expected: liveness is public/cheap; readiness protected/cheap; logs JSON with correlation/request ID and redaction; CSP/HSTS/nosniff/referrer/permissions headers pass.

- [ ] **Step 2: Add deployed smoke assertions**

Public liveness returns minimal status without dependency details. Unauthorized readiness is rejected. Authorized readiness has bounded timeout. Headers/log correlation are observed in staging.

- [ ] **Step 3: Fix only observed regressions and rerun**

Expected: zero security/header/log leak.

- [ ] **Step 4: Commit evidence/fix**

```bash
git add src docs/superpowers/audits/o5-g04-release-regression.md
git commit -m "test(release): lock health logging and headers"
```

Replace broad staging with exact changed health/logger/header paths.

## Task 5: O5-G05 — Metrics, SLO, alerts and runbooks

**Files:**
- Modify: structured metrics/telemetry modules
- Create: `docs/ops/slo.md`
- Create: `docs/runbooks/alerts/`
- Create: metrics/alert contract tests
- Create: `docs/superpowers/audits/o5-g05-observability.md`

- [ ] **Step 1: Define measurable signals**

For auth, DB, webhook, Queue, agent, provider and sidecar define availability, latency, error/failure/retry/DLQ rates, aggregation window, target, burn/threshold and owner. No PII labels or unbounded cardinality.

- [ ] **Step 2: RED instrumentation tests**

Each critical success/failure emits metric and correlation ID. Tenant/client labels use approved non-PII identifiers. Alerts map to an existing runbook.

- [ ] **Step 3: Implement minimal metrics and alerts**

Instrument boundaries, not every function. Create actionable alert text: impact, first query, rollback/mitigation and escalation owner.

- [ ] **Step 4: Run synthetic alert tests**

Inject auth failure spike, DB timeout, webhook invalid/replay, Queue DLQ, agent/provider down and sidecar down. Expected: correct alert/runbook, no alert on healthy baseline.

- [ ] **Step 5: Commit**

```bash
git add src docs/ops/slo.md docs/runbooks/alerts docs/superpowers/audits/o5-g05-observability.md
git commit -m "feat(ops): add service slo and actionable alerts"
```

Stage only telemetry modules touched.

## Task 6: O5-G06 — Release versions, skew, abort and rollback

**Files:**
- Create/modify: shared release version contract
- Modify: app/bridge/agent RPC/version responses
- Modify: DO state/schema compatibility tests
- Create: `docs/runbooks/release-rollback.md`
- Create: `docs/superpowers/audits/o5-g06-version-rollback.md`

- [ ] **Step 1: RED version matrix**

Test old/new and new/old combinations for app, bridge, agent, RPC, DB schema and DO state. Unsupported combination fails before side effect and returns actionable compatibility code.

- [ ] **Step 2: Define abort thresholds**

Use O5-G05 signals. Abort on failed smoke/readiness, migration/preflight mismatch, critical security error, incompatible RPC/schema/DO, or SLO breach above documented threshold/window.

- [ ] **Step 3: Implement version handshake**

Every service exposes release and contract versions without secrets. App checks bridge/agent compatibility; worker accepts documented rolling window; DO migration version is independent and monotonic.

- [ ] **Step 4: Exercise local/staging matrix**

Deploy bridge/agent/app versions in both supported skew orders; run smoke; roll app/workers back; verify DB remains compatible. After expand migration, prove roll-forward when old app is incompatible.

- [ ] **Step 5: Fault-inject rollback**

Break app smoke and agent readiness separately. Expected: pipeline aborts, invokes correct rollback and alerts; no data loss/duplicate effect.

- [ ] **Step 6: Commit**

```bash
git add src .github scripts docs/runbooks/release-rollback.md docs/superpowers/audits/o5-g06-version-rollback.md
git commit -m "feat(release): enforce version skew and rollback"
```

Stage only release/version/deploy paths.

## Task 7: O5-G07 — Prepare and execute pilot provisioning gates

**Files:**
- Create: `docs/pilot/pilot-charter.md`
- Create: `docs/pilot/data-import-approval.md`
- Create: `docs/superpowers/audits/o5-g07-pilot-provision.md`
- Use: lifecycle scripts from O5-G02

- [ ] **Step 1: Prepare gate O5-X01**

Require named pilot owner/team, dedicated tenant, maintenance window, approved modules/channels, support contacts, rollback, data classification and explicit authorization.

- [ ] **Step 2: Prepare gate O5-X02**

Dataset must be synthetic, anonymized or explicitly approved. Record checksum, columns, row counts, rejection policy, retention, importer version and rollback batch.

- [ ] **Step 3: Dry-run provisioning/import**

```bash
node scripts/provision-client.mjs --client pilot --environment staging
node scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv
```

Expected: redacted previews only; no external mutation.

- [ ] **Step 4: Execute after receipts**

Use `--apply` only after O5-X01/O5-X02 authorization. Verify dedicated resources, owner, clinics, RBAC/modules, team, import, channels and test appointment.

- [ ] **Step 5: Run rollback rehearsal before participant access**

Expected: import batch reverses; app/worker version rollback succeeds; backup restore procedure is timed and recorded.

- [ ] **Step 6: Commit pilot charter/receipts**

```bash
git add docs/pilot/pilot-charter.md docs/pilot/data-import-approval.md docs/superpowers/audits/o5-g07-pilot-provision.md
git commit -m "docs(pilot): record approved pilot provisioning"
```

Never commit approved import data or secret values.

## Task 8: O5-G08 — Execute journeys, outage drills, UX and performance

**Files:**
- Modify/create: `e2e/journeys/j-01` through `j-12` specs
- Create: `docs/pilot/outage-drills.md`
- Create: `docs/pilot/accessibility-performance.md`
- Create: `docs/superpowers/audits/o5-g08-pilot-validation.md`

- [ ] **Step 1: Execute J-01–J-12 against release candidate**

No baseline beta capacity or hidden skips. Each journey records actor, result, required negative case, run URL/version and receipt.

- [ ] **Step 2: Gate and run outage drills**

O5-X03 authorizes controlled Evolution, LLM, DB, Queue and sidecar failure. For each: expected degraded/fail-closed behavior, alert, runbook action, recovery time and data-integrity check.

- [ ] **Step 3: Validate mobile/desktop/accessibility**

Run approved viewport matrix, keyboard navigation, focus, labels, contrast and critical automated accessibility specs. Record defects by severity.

- [ ] **Step 4: Validate performance**

Measure critical pages/journeys on the candidate. Compare with accepted thresholds for load, interaction and backend/worker latency; investigate regression rather than loosening threshold.

- [ ] **Step 5: Run full release suite**

```bash
npm run roadmap:check
npm run verify
npm run test:integration:run
npm run test:security -- --runInBand
npm run test:release
npm run build
npm run test:e2e:production
npm run build:cf
npx wrangler deploy --dry-run --config wrangler.toml
```

Expected: all exit 0 on the candidate commit; remote CI/deploy staging green.

- [ ] **Step 6: Commit validation receipts**

```bash
git add e2e/journeys docs/pilot/outage-drills.md docs/pilot/accessibility-performance.md docs/superpowers/audits/o5-g08-pilot-validation.md
git commit -m "test(pilot): verify journeys outages and ux"
```

## Task 9: O5-G09 — Training, scorecard, rubric and GO

**Files:**
- Create: `docs/pilot/training-feedback.md`
- Create: `docs/pilot/pilot-scorecard.md`
- Create: `docs/superpowers/audits/roadmap-143-final-rubric.md`
- Modify: `docs/superpowers/audits/roadmap-143-ledger.json`
- Modify: `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md`
- Modify: `docs/goals/roadmap-143-resume.md`

- [ ] **Step 1: Deliver training and capture feedback**

O5-X04 names team/session/owner. Record attendance, scenarios, questions and defects. Feedback creates separately triaged work; it never silently changes 143-item scope.

- [ ] **Step 2: Validate ledger final state**

```bash
npm run roadmap:check
```

Expected: 143 unique IDs; every status `VERIFIED`; every record has command/output/commit/reviewer/risk/rollback and external receipt where required.

- [ ] **Step 3: Produce pilot scorecard**

Include defects by severity, security findings, SLO results, incident/drill results, usability/accessibility/performance, training/feedback, open risks and operations readiness.

- [ ] **Step 4: Calculate final rubric**

Score: closure 25; journeys 15; security/tenancy/LGPD 15; data/migrations/concurrency 15; tests/coverage/mutation/review 15; runtime/deploy/observability/rollback 10; operation/pilot/traceability 5.

Required: score ≥90 and all hard gates green. Any missing hard gate means `NO-GO` regardless of score.

- [ ] **Step 5: Obtain formal O5-X05 decision**

Owner reviews scorecard and records `GO` or `NO-GO`, date, candidate SHA, accepted residual risks and conditions. Agent cannot self-approve.

- [ ] **Step 6: Reconcile source roadmap and commit**

```bash
git add docs/pilot/training-feedback.md docs/pilot/pilot-scorecard.md docs/superpowers/audits/roadmap-143-final-rubric.md docs/superpowers/audits/roadmap-143-ledger.json docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md docs/goals/roadmap-143-resume.md
git commit -m "docs(program): close roadmap 143 with pilot rubric"
```

## Task 10: Final independent review

**Files:**
- Read-only review of candidate commit and all program artifacts

- [ ] **Step 1: Review hard gates**

Verify 143/143, zero other status, CI candidate SHA, coverage ≥70 without gaming, zero unaccepted critical/high finding, migration/rollback evidence, J-01–J-12, provider/drill/pilot receipts and formal GO.

- [ ] **Step 2: Review repository state**

```bash
git status --short
git log -1 --format="%H %s"
```

Expected: clean tree and candidate SHA equals reviewed/deployed/scorecard SHA.

- [ ] **Step 3: Publish final report to owner**

Report before/after counts, goals, commits/PRs/CI, command outputs, receipts, score breakdown, findings resolved, residual risks, rollback and GO/NO-GO. If any proof differs, reopen owning item rather than editing the score.
