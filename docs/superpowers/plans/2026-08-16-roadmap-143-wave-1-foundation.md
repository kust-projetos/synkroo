# Synkroo Roadmap 143 Wave 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar F0–F3 com segurança, auth, tenancy, migrations, CI e runtime prontos para sustentar as ondas de produto.

**Architecture:** Onze goals serializam fronteiras compartilhadas e mantêm gates humanos separados da preparação local. Itens já `VERIFIED` entram em regressão; itens externos permanecem `EVIDENCE_PENDING` até receipt nominal.

**Tech Stack:** NextAuth v4, Drizzle/PostgreSQL 17, Jest/Stryker, GitHub Actions, OpenNext, Cloudflare Workers/Hyperdrive/Queues.

**Agent Orchestration:** Hierarchical — supervisor O1; workers por goal; DB/auth/CI/Workers em lanes seriais; reviewers independentes.

---

## Ownership

| Goal | IDs | Risco | Dependências |
|---|---|---|---|
| O1-G01 incident-controls | F0.01–F0.10 | crítico | Gate R |
| O1-G02 git-baseline | F1.01–F1.08 | relevante | O1-G01 local |
| O1-G03 tenant-actions | F2.03–F2.08 | crítico | O1-G02 |
| O1-G04 auth-revocation | F2.11, F2.19 | crítico | O0 cluster A |
| O1-G05 security-regression | F2.01, F2.02, F2.09, F2.10, F2.12, F2.13, F2.15–F2.18 | crítico | O1-G03/O1-G04 |
| O1-G06 hyperdrive-bridge | F2.14 | crítico | O1-G05, O1-G08 |
| O1-G07 db-integrity | F3.01, F3.04–F3.07 | crítico | O1-G05 |
| O1-G08 runtime-env | F3.02, F3.03 | crítico | O1-G02 |
| O1-G09 async-boundaries | F3.08, F3.09 | crítico | O1-G07/O1-G08 |
| O1-G10 test-platform | F3.10–F3.15 | crítico | O1-G03–O1-G09 |
| O1-G11 staging-runtime | F3.16, F3.17 | crítico | O1-G06/O1-G07/O1-G09/O1-G10 |

## Task 1: O1-G01 — Incident controls and owner gates

**Files:**
- Modify: `.gitleaksignore`
- Modify: `.gitleaks.toml`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/gitleaks-scheduled.yml`
- Create: `docs/security/credential-inventory.md`
- Create: `docs/superpowers/audits/o1-g01-incident-controls.md`
- Test: `scripts/__tests__/gitleaks-policy.test.mjs`

- [ ] **Step 1: Write/extend policy tests**

Tests assert scheduled and blocking CI scans use full history, staged scans redact output, every suppression has fingerprint/classification/owner, and inventory contains no value-like secret patterns.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/__tests__/gitleaks-policy.test.mjs
```

Expected: fail on each missing policy assertion; if already green, add assertions for the six `confirmed-owner-action` suppressions before proceeding.

- [ ] **Step 3: Minimize local suppressions**

Keep only entries proven as test fixture or false positive. Move six owner-action entries into the sanitized inventory; do not delete a suppression until the associated secret has a rotation receipt.

- [ ] **Step 4: Run local scans**

```bash
gitleaks protect --staged --redact
gitleaks detect --source . --log-opts="--all" --redact --verbose
```

Expected: staged scan exits 0; full-history scan either exits 0 or produces a bounded receipt/timeout recorded without exposing values.

- [ ] **Step 5: Emit gate O1-X01**

Gate contains F0.04–F0.07/F0.10, providers/owners, exact rotation/audit actions, clone/history coordination, rollback/communications plan and expected fingerprint receipts. F0.01 receives an explicit decision record replacing `DEFERRED`.

- [ ] **Step 6: Commit local controls**

```bash
git add .gitleaksignore .gitleaks.toml .github/workflows/ci.yml .github/workflows/gitleaks-scheduled.yml docs/security/credential-inventory.md docs/superpowers/audits/o1-g01-incident-controls.md scripts/__tests__/gitleaks-policy.test.mjs
git commit -m "security(secrets): close local incident controls"
```

F0.04–F0.07/F0.10 remain `EVIDENCE_PENDING` until gate receipts arrive.

## Task 2: O1-G02 — Git decisions and reproducible baseline

**Files:**
- Create: `docs/superpowers/audits/o1-g02-git-baseline.md`
- Modify: `docs/goals/roadmap-143-resume.md`
- Inspect: PR #6 and commits named by the current roadmap

- [ ] **Step 1: Prove local commit ancestry**

```bash
git status --short --branch
git log --graph --decorate --oneline -30
git branch --contains 70839ad8
git branch --contains e3a9c134
git branch --contains 4234263e
git branch --contains 4cbe3cac
```

Expected: ancestry for every expected RBAC/CRM/Finance/cron/migration commit is recorded.

- [ ] **Step 2: Inspect PR #6 under rotated auth**

```bash
gh auth status
gh pr view 6 --json number,state,headRefName,baseRefName,commits,mergeable,url
```

Expected: sanitized metadata only. If auth is unavailable, emit O1-X02 with the exact `gh auth login` gate and continue local ancestry work.

- [ ] **Step 3: Resolve deferred merge/rebase items**

Record one of: `N/A — content already present`, `merge approved PR`, or `recreate branch without content change`. Never merge/rebase merely to close a checkbox.

- [ ] **Step 4: Re-run baseline**

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:integration:run
npm run build
npm run build:cf
```

Expected: all exit 0 on the same commit. Preserve machine-readable outputs and confirm `AGENTS.md` unchanged.

- [ ] **Step 5: Commit decision record**

```bash
git add docs/superpowers/audits/o1-g02-git-baseline.md docs/goals/roadmap-143-resume.md
git commit -m "docs(baseline): resolve git and PR decisions"
```

## Task 3: O1-G03 — Tenant-scoped Core Actions and races

**Files:**
- Modify: `src/modules/core/actions/`
- Modify: `src/modules/core/actions/__tests__/integration.test.ts`
- Modify: relevant Action validation schemas under `src/lib/validations/`
- Create: `docs/superpowers/audits/o1-g03-tenant-actions.md`

- [ ] **Step 1: Add RED matrix**

For every mutating Core Action, add cases for payload `clinicId` mismatch, foreign role/user/entity, treatment item from another plan, duplicate POST, and two concurrent updates. Each assertion verifies zero foreign mutation and stable final state.

- [ ] **Step 2: Run RED**

```bash
npm run test:integration:run
```

Expected: new negative/race cases fail before implementation. Preserve the failing test names in the audit.

- [ ] **Step 3: Implement fail-closed scope**

Remove payload-controlled scope or compare it to trusted context before repository access. Repository updates include clinic and entity owner predicates; duplicate/retry paths use idempotency keys and transactions.

- [ ] **Step 4: Run GREEN twice**

```bash
npm run test:integration:run
npm run test:integration:run
```

Expected: both runs pass; concurrent final state is deterministic.

- [ ] **Step 5: Run mutation and review**

```bash
npm run test:security:repositories
```

Reviewer checks every Action from the roadmap, not a sample. Valid scope/idempotency mutants must be killed.

- [ ] **Step 6: Commit**

```bash
git add src/modules/core/actions src/lib/validations docs/superpowers/audits/o1-g03-tenant-actions.md
git commit -m "security(actions): enforce tenant and race invariants"
```

## Task 4: O1-G04 — Finish auth revocation mutation proof

**Files:**
- Modify: auth files committed by O0 cluster A only when residual behavior requires it
- Modify: `docs/superpowers/audits/2026-08-15-f2-11-revocation-primitive.md`
- Modify: `stryker.repositories.config.json`

- [ ] **Step 1: Re-run focused unit/integration**

```bash
npx jest src/repositories/auth/__tests__/revocation.test.ts src/app/api/auth/change-password/route.test.ts --runInBand
npm run test:integration:run
```

Expected: disabled user, logout, password, role and access changes invalidate incompatible sessions; same-password race permits at most one success.

- [ ] **Step 2: Classify all auth survivors**

```bash
npm run test:security:repositories
```

For each of the recorded 33 survivors/one no-coverage line, classify `killed by new test`, `equivalent with proof`, or `valid residual`. No generic waiver is accepted.

- [ ] **Step 3: Add minimal tests for valid residuals**

Tests target exact altered branch/condition and fail when the mutant is manually simulated.

- [ ] **Step 4: Re-run mutation**

Expected: repository score remains ≥70%, revocation-critical survivors are zero, and F2.11 has nominal proof.

- [ ] **Step 5: Commit evidence/fixes**

```bash
git add src/repositories/auth src/app/api/auth/change-password stryker.repositories.config.json docs/superpowers/audits/2026-08-15-f2-11-revocation-primitive.md
git commit -m "test(auth): kill revocation mutation survivors"
```

## Task 5: O1-G05 — Security regression gate

**Files:**
- Inspect: `src/lib/auth/`, `src/app/api/auth/`, middleware, webhook handlers and audit utilities
- Create: `docs/superpowers/audits/o1-g05-security-regression.md`

- [ ] **Step 1: Run focused suites**

```bash
npm run test:security -- --runInBand
npm run test:security:integration
npm run test:integration:run
```

Expected: NextAuth-only boundary, production signup 404, disabled session rejection, audit allowlist, Asaas transaction, exact public routes, CSRF/Origin, internal redirect and empty permission fallback pass.

- [ ] **Step 2: Adversarial review**

Add or confirm tests for nested PII, Unicode/internal redirect confusion, prefix route bypass, webhook replay and empty permission data. Failures become fixes in their owning file.

- [ ] **Step 3: Re-run all security gates**

Expected: zero critical/high review finding and no regression in verified F2 items.

- [ ] **Step 4: Commit only new regressions/evidence**

```bash
git add src docs/superpowers/audits/o1-g05-security-regression.md
git commit -m "test(security): lock verified foundation boundaries"
```

## Task 6: O1-G07 — Database normalization, constraints and indexes

**Files:**
- Modify: `src/lib/db/schema/`
- Create/modify: Drizzle migrations and `src/lib/db/migrations/meta/`
- Create: `scripts/preflight-email-normalization.mjs`
- Create: `scripts/__tests__/preflight-email-normalization.test.mjs`
- Modify: DB integration tests
- Create: `docs/superpowers/audits/o1-g07-db-integrity.md`

- [ ] **Step 1: Write RED tests**

Cases: same-clinic trim/case collision rejected; cross-clinic same normalized email accepted; duplicate preflight read-only; appointment exclusion/index catalog present; `vector` and `btree_gist` precede dependent schema; RBAC CLI remains dry-run by default.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/__tests__/preflight-email-normalization.test.mjs
npm run test:integration:run
```

Expected: normalization/catalog cases expose remaining gaps.

- [ ] **Step 3: Implement canonical normalization and expand migration**

Use one trim/lowercase boundary shared by writes and migration. Preflight prints clinic-scoped duplicate counts/IDs without PII. Migration aborts on duplicates and creates constraints/indexes only after extensions.

- [ ] **Step 4: Generate and inspect migration**

```bash
npm run db:generate
npm run db:migrate -- --help
```

Inspect SQL and journal. Expected: no destructive drop, no table rewrite without rationale, extensions precede dependent objects.

- [ ] **Step 5: Run isolated apply**

```bash
npm run test:integration:run
```

Expected: clean `synkroo_test` applies migration and tests pass.

- [ ] **Step 6: Emit gate O1-X03**

For owner-controlled staging: duplicate report, approved remediation, backup, `DATABASE_URL`-explicit command, catalog queries, rollback-compatible app version and expected receipt.

- [ ] **Step 7: Commit local migration**

```bash
git add src/lib/db scripts/preflight-email-normalization.mjs scripts/__tests__/preflight-email-normalization.test.mjs docs/superpowers/audits/o1-g07-db-integrity.md
git commit -m "feat(db): enforce normalized tenant integrity"
```

## Task 7: O1-G08 — Runtime-specific environment contracts

**Files:**
- Modify: `src/lib/env.ts`
- Create/modify: env modules under `src/workers/ia-bridge/` and `src/workers/ia-agent/`
- Create: sidecar env validation module in its existing package
- Modify: runtime bootstrap tests
- Create: `docs/superpowers/audits/o1-g08-runtime-env.md`

- [ ] **Step 1: Add table-driven RED tests**

For app, bridge, agent and sidecar, test required names, empty values, minimum secret length and production-only rules. Outputs contain variable names, never values.

- [ ] **Step 2: Run RED**

```bash
npm test -- --runInBand src/lib/__tests__/env.test.ts
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
```

Expected: missing runtime wiring or validation fails before implementation.

- [ ] **Step 3: Implement fail-fast schemas and bootstrap wiring**

Each runtime imports only its own schema. No process-global schema requires variables belonging to another worker.

- [ ] **Step 4: Run GREEN and startup contracts**

```bash
npm test -- --runInBand src/lib/__tests__/env.test.ts
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
npm run build:cf
```

Expected: valid fixtures pass; invalid startup fails with sanitized variable names.

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/workers docs/superpowers/audits/o1-g08-runtime-env.md
git commit -m "feat(runtime): validate environment per worker"
```

## Task 8: O1-G09 — Outbox, Queue, retry, DLQ and boundaries

**Files:**
- Modify: `src/lib/idempotency/`
- Modify: outbox schema/repositories/services in their existing module paths
- Modify: Queue producer/consumer worker code
- Modify: boundary architecture tests
- Create: `docs/superpowers/audits/o1-g09-async-boundaries.md`

- [ ] **Step 1: Add RED contract tests**

Cases: duplicate delivery applies once; transient failure retries with bounded backoff; permanent failure reaches observable DLQ; consumer crash after provider success reconciles without duplicate effect; cross-module imports do not execute side effects.

- [ ] **Step 2: Run RED**

```bash
npm test -- --runInBand src/lib/idempotency
npm run test:integration:run
```

Expected: missing runtime/DLQ cases fail.

- [ ] **Step 3: Implement minimal primitives**

Persist idempotency and outbox state transactionally before dispatch. Consumers acknowledge only after durable transition; retries are bounded and DLQ entries include correlation ID without PII.

- [ ] **Step 4: Run GREEN and boundary lint**

```bash
npm test -- --runInBand src/lib/idempotency
npm run test:integration:run
npm run lint
```

Expected: idempotency/retry tests and boundary rules pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/idempotency src/lib/db src/workers docs/superpowers/audits/o1-g09-async-boundaries.md
git commit -m "feat(async): harden outbox and queue delivery"
```

## Task 9: O1-G10 — Test platform, coverage, audit and CI

**Files:**
- Modify: `jest.config.js`
- Modify: Playwright configs and auth setup under `e2e/`
- Modify: `scripts/verify.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Create: `docs/superpowers/audits/o1-g10-test-platform.md`

- [ ] **Step 1: Baseline coverage by directory**

```bash
npm test -- --coverage --runInBand
```

Expected initial metrics match or supersede 54.84% statements, 40.45% branches, 56.06% lines and 42.96% functions. Preserve `coverage-summary.json` metrics only, not generated HTML.

- [ ] **Step 2: Audit coverage policy**

Review `collectCoverageFrom`; do not add exclusions. Decide explicitly whether `.tsx` exclusion remains justified by separate E2E/component coverage. The global 70% requirement cannot close while a material v1 surface is unmeasured without a documented alternate gate.

- [ ] **Step 3: Add behavioral tests by largest uncovered critical modules**

Prioritize auth/tenancy, Actions, migrations, finance, LGPD, Queue and agent side effects before getters/formatters. Each test must fail on a meaningful behavior mutation.

- [ ] **Step 4: Repair E2E integrity**

Remove catches, tautological assertions and default skips; require auth setup and isolated DB. Production config remains zero retries.

- [ ] **Step 5: Triage npm audit**

```bash
npm audit --json
npm audit --omit=dev --audit-level=high
```

Update safely or write an owner-expiring waiver containing package, advisory, reachability, mitigation, owner and expiry. Emit O1-X05 for owner acceptance when a waiver remains.

- [ ] **Step 6: Make verify and CI equivalent**

CI invokes the same lint/typecheck/unit/coverage/contracts commands as `npm run verify`, plus PostgreSQL 17 integration, security, build, production E2E, OpenNext and Wrangler dry-run.

- [ ] **Step 7: Run local gate**

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

Expected: every command exits 0 and global coverage reaches configured 70% without weakened measurement.

- [ ] **Step 8: Push and verify remote CI**

Push/PR is authorized. Expected: Gitleaks, CI and CF jobs green on the exact commit; retain run URL/SHA.

- [ ] **Step 9: Commit**

```bash
git add jest.config.js e2e scripts/verify.mjs .github/workflows/ci.yml package.json docs/superpowers/audits/o1-g10-test-platform.md
git commit -m "test(platform): enforce complete release gates"
```

## Task 10: O1-G06/O1-G11 — Hyperdrive and staging walking skeleton

**Files:**
- Modify: `src/workers/ia-bridge/`
- Modify: `src/workers/ia-agent/`
- Modify: `wrangler.toml` and worker configs
- Modify: pool/client lifecycle code under `src/lib/db/`
- Modify: `scripts/smoke-staging.mjs`
- Create: `docs/superpowers/audits/o1-g11-staging-runtime.md`

- [ ] **Step 1: Lock local contracts**

```bash
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
npm run build:cf
npx wrangler deploy --dry-run --config wrangler.toml
```

Expected: Hyperdrive binding is required, db-backed tool fails closed without it and bundles contain no static database URL.

- [ ] **Step 2: Add lifecycle/concurrency test**

Run eight or more concurrent db-health/tool calls under local workerd, then dispose/reload worker. Assert bounded pool/client creation, no request-global leak and deterministic failure when DB is unavailable.

- [ ] **Step 3: Run local workerd smoke**

Expected: app → bridge → agent → PostgreSQL path succeeds locally and failure-mode tests pass.

- [ ] **Step 4: Emit gate O1-X04**

Gate specifies authorized Cloudflare account, isolated staging worker names, Hyperdrive binding IDs by name only, secrets to set manually, deploy command, db-backed invocation, concurrency probe, log redaction, rollback command and sanitized receipts.

- [ ] **Step 5: Deploy staging after gate receipt**

Push/deploy to configured staging is authorized only after bindings/secrets exist. Expected receipts: deployed versions, 200 db-backed tool response, eight-way concurrency result, provider/DB failure responses and rollback success.

- [ ] **Step 6: Commit local lifecycle fixes and evidence**

```bash
git add src/workers src/lib/db wrangler.toml scripts/smoke-staging.mjs docs/superpowers/audits/o1-g11-staging-runtime.md
git commit -m "feat(runtime): verify Hyperdrive worker lifecycle"
```

## Task 11: Run Gate 1

**Files:**
- Modify: `docs/superpowers/audits/roadmap-143-ledger.json`
- Modify: `docs/goals/roadmap-143-resume.md`
- Create: `docs/superpowers/audits/o1-foundation-gate.md`

- [ ] **Step 1: Run complete gate**

```bash
npm run roadmap:check
npm run verify
npm run test:integration:run
npm run test:security -- --runInBand
npm run test:security:integration
npm run test:release
npm run build
npm run test:e2e:production
npm run build:cf
npx wrangler deploy --dry-run --config wrangler.toml
```

Expected: all exit 0; coverage ≥70%; remote CI green.

- [ ] **Step 2: Validate item ownership**

Expected: all 54 F0–F3 IDs have nominal evidence or an unresolved R4/R5 gate packet. Gate 1 cannot close while any remains non-`VERIFIED`.

- [ ] **Step 3: Independent security/architecture review**

Required findings: zero blocker/high. Review tenancy, secrets, migrations, pool lifecycle, retries, CI parity and rollback.

- [ ] **Step 4: Score O1**

Required: every goal ≥9/10 and wave hard gates green.

- [ ] **Step 5: Commit gate evidence**

```bash
git add docs/superpowers/audits/roadmap-143-ledger.json docs/goals/roadmap-143-resume.md docs/superpowers/audits/o1-foundation-gate.md
git commit -m "docs(program): close foundation wave gate"
```
