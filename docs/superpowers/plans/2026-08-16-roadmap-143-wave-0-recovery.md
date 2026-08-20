# Synkroo Roadmap 143 Wave 0 Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preservar e reconciliar o working tree atual, estabelecer uma única verdade documental e gerar o ledger/checkpoint que governará os 143 itens.

**Architecture:** O0 não altera requisitos do produto. Ela transforma estado local e documentos dispersos em cinco commits verificáveis, um ledger validável e um registry de blockers; nenhum novo pacote de produto inicia antes do Gate R.

**Tech Stack:** Git, Node.js 20 ESM, Markdown, JSON, Jest/Node test runner, scripts npm existentes.

**Agent Orchestration:** Supervisor-Workers — um supervisor serializa os commits; reviewers read-only inspecionam cada cluster.

---

## Precondições

- Branch inicial: `main`.
- Não usar `git reset --hard`, `git clean`, stash destrutivo ou overwrite.
- O commit `59c55071` contém somente a spec do programa.
- Working tree observado no planejamento:

```text
M docs/superpowers/audits/2026-08-15-f2-11-revocation-primitive.md
M docs/superpowers/audits/2026-08-15-f2-14-hyperdrive-contract.md
M docs/superpowers/audits/2026-08-15-f3-14-verify-runner.md
M docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md
M scripts/seed-test-clinic.mjs
M src/repositories/auth/__tests__/integration.test.ts
M src/repositories/auth/__tests__/revocation.test.ts
M src/repositories/auth/index.ts
M stryker.repositories.config.json
?? reports/
?? scripts/__tests__/seed-test-clinic-idempotency.test.mjs
?? src/app/api/auth/change-password/
?? src/lib/__tests__/validation.test.ts
?? src/lib/api/__tests__/action-route.test.ts
?? src/lib/api/action-route.ts
?? src/repositories/auth/__tests__/password-change.integration.test.ts
?? src/services/treatment-plans/__tests__/
```

Se o estado real divergir, registrar a diferença no inventário antes de tocar arquivos.

### Task 1: Preservar e classificar o working tree

**Files:**
- Create: `docs/superpowers/audits/2026-08-16-o0-working-tree-inventory.md`
- Inspect: every path returned by `git status --short`

- [ ] **Step 1: Capture immutable metadata**

Run:

```bash
git rev-parse HEAD
git branch --show-current
git status --short
git diff --stat
git diff --name-status
git diff --check
```

Expected: branch and commit printed; `git diff --check` exits 0. Any whitespace failure becomes the first local fix in its owning cluster.

- [ ] **Step 2: Review each diff without modifying it**

Run:

```bash
git diff -- docs/superpowers/audits/2026-08-15-f2-11-revocation-primitive.md
git diff -- docs/superpowers/audits/2026-08-15-f2-14-hyperdrive-contract.md
git diff -- docs/superpowers/audits/2026-08-15-f3-14-verify-runner.md
git diff -- docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md
git diff -- scripts/seed-test-clinic.mjs
git diff -- src/repositories/auth/index.ts
git diff -- src/repositories/auth/__tests__/integration.test.ts
git diff -- src/repositories/auth/__tests__/revocation.test.ts
git diff -- stryker.repositories.config.json
```

Expected: every tracked change is visible and attributable; no secret value appears.

- [ ] **Step 3: Create the inventory**

Write the inventory with this exact classification:

| Cluster | Paths | Roadmap ownership | Disposition |
|---|---|---|---|
| Auth revocation/password | `src/repositories/auth/index.ts`, auth tests, `src/app/api/auth/change-password/`, `stryker.repositories.config.json`, F2.11 audit | F2.11 | verify and commit as cluster A |
| Hyperdrive evidence | F2.14 audit | F2.14/F3.17 | keep partial until real staging receipt |
| Verify/coverage evidence | F3.14 audit, validation/action/treatment tests where applicable | F3.14/F4.02/F5.05 | split by behavioral owner |
| Seed idempotency | seed script and Node test | F3.13/F3.15 support | verify and commit as cluster B |
| Action route | action route source/test | F4.02 | verify and commit as cluster C |
| Treatment plan tests | treatment service tests | F5.05 | verify and commit as cluster D |
| Roadmap reconciliation | master pending plan | all touched IDs | commit after cluster evidence |
| Mutation reports | `reports/mutation/` | generated evidence | do not commit HTML/JSON; preserve metrics in audit |

Expected: every status path appears exactly once. Unknown paths are added as a new row before proceeding.

- [ ] **Step 4: Verify inventory completeness**

Run a script that compares backticked paths in the inventory against `git status --short`. Expected: zero unclassified paths after collapsing directory entries to their files.

- [ ] **Step 5: Commit the inventory only**

```bash
git add docs/superpowers/audits/2026-08-16-o0-working-tree-inventory.md
git diff --cached --name-only
git commit -m "docs(program): inventory roadmap recovery worktree"
```

Expected staged path: only the inventory.

### Task 2: Verify and commit cluster A — password revocation

**Files:**
- Modify: `src/repositories/auth/index.ts`
- Modify: `src/repositories/auth/__tests__/integration.test.ts`
- Modify: `src/repositories/auth/__tests__/revocation.test.ts`
- Create: `src/repositories/auth/__tests__/password-change.integration.test.ts`
- Create: `src/app/api/auth/change-password/route.ts`
- Create: `src/app/api/auth/change-password/route.test.ts`
- Modify: `stryker.repositories.config.json`
- Modify: `docs/superpowers/audits/2026-08-15-f2-11-revocation-primitive.md`

- [ ] **Step 1: Run focused unit tests**

```bash
npx jest src/repositories/auth/__tests__/revocation.test.ts src/app/api/auth/change-password/route.test.ts --runInBand
```

Expected: both suites pass; old password, invalid current password, same-password race and session-version assertions remain active.

- [ ] **Step 2: Run isolated PostgreSQL integration**

```bash
npm run test:integration:run
```

Expected: runner accepts only loopback `synkroo_test`, migrations/seed pass and password-change integration passes.

- [ ] **Step 3: Run focused mutation**

```bash
npm run test:security:repositories
```

Expected: report prints repository and auth mutation scores. Valid survivors in password/revocation branches require new assertions before commit; equivalent mutants are documented with line and reason.

- [ ] **Step 4: Review the diff independently**

Reviewer checks transaction boundary, credential lock, hash comparison, `sessionVersion + 1`, no user enumeration, rate limit, tenant scope and race behavior.

Expected: zero blocker/high finding.

- [ ] **Step 5: Commit cluster A**

```bash
git add src/repositories/auth/index.ts src/repositories/auth/__tests__/integration.test.ts src/repositories/auth/__tests__/revocation.test.ts src/repositories/auth/__tests__/password-change.integration.test.ts src/app/api/auth/change-password/route.ts src/app/api/auth/change-password/route.test.ts stryker.repositories.config.json docs/superpowers/audits/2026-08-15-f2-11-revocation-primitive.md
git diff --cached --name-only
git commit -m "feat(auth): revoke sessions on password change"
```

Expected: only cluster A paths staged.

### Task 3: Verify and commit cluster B — seed idempotency

**Files:**
- Modify: `scripts/seed-test-clinic.mjs`
- Create: `scripts/__tests__/seed-test-clinic-idempotency.test.mjs`

- [ ] **Step 1: Run the Node regression test**

```bash
node --test scripts/__tests__/seed-test-clinic-idempotency.test.mjs
```

Expected: test passes and proves deterministic clinic identity on repeated seed.

- [ ] **Step 2: Run release script contracts**

```bash
npm run test:release
```

Expected: all release contract tests pass.

- [ ] **Step 3: Run the isolated integration seed twice**

```bash
npm run test:integration:run
npm run test:integration:run
```

Expected: both runs pass without duplicate clinic, user or access rows.

- [ ] **Step 4: Commit cluster B**

```bash
git add scripts/seed-test-clinic.mjs scripts/__tests__/seed-test-clinic-idempotency.test.mjs
git commit -m "fix(test-db): make clinic seed idempotent"
```

### Task 4: Verify and commit cluster C — Action route contract

**Files:**
- Create: `src/lib/api/action-route.ts`
- Create: `src/lib/api/__tests__/action-route.test.ts`
- Create: `src/lib/__tests__/validation.test.ts`

- [ ] **Step 1: Run focused tests**

```bash
npx jest src/lib/api/__tests__/action-route.test.ts src/lib/__tests__/validation.test.ts --runInBand
```

Expected: success/error envelope, request ID, schema failure, auth/policy failure and unexpected-error redaction pass.

- [ ] **Step 2: Typecheck and lint the files**

```bash
npm run typecheck
npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Review transport boundary**

Reviewer confirms route adapter contains no domain rule, uses canonical `ApiSuccess`/`ApiFailure`, never leaks error objects and preserves response status.

- [ ] **Step 4: Commit cluster C**

```bash
git add src/lib/api/action-route.ts src/lib/api/__tests__/action-route.test.ts src/lib/__tests__/validation.test.ts
git commit -m "feat(api): add shared action route adapter"
```

### Task 5: Verify and commit cluster D — treatment plan evidence

**Files:**
- Create: `src/services/treatment-plans/__tests__/treatment-plan.service.test.ts`

- [ ] **Step 1: Run the focused suite**

```bash
npx jest src/services/treatment-plans/__tests__/treatment-plan.service.test.ts --runInBand
```

Expected: eight or more behavioral tests pass for clinic/plan/item ownership, session idempotency and valid state transitions.

- [ ] **Step 2: Run relevant integration**

```bash
npm run test:integration:run
```

Expected: PostgreSQL integration remains green.

- [ ] **Step 3: Commit cluster D**

```bash
git add src/services/treatment-plans/__tests__/treatment-plan.service.test.ts
git commit -m "test(treatments): cover ownership and session invariants"
```

### Task 6: Reconcile evidence documents and generated reports

**Files:**
- Modify: `docs/superpowers/audits/2026-08-15-f2-14-hyperdrive-contract.md`
- Modify: `docs/superpowers/audits/2026-08-15-f3-14-verify-runner.md`
- Modify: `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add generated mutation reports to ignore rules**

Append exactly:

```gitignore
# Generated Stryker reports; durable metrics live in docs/superpowers/audits/.
reports/mutation/
```

- [ ] **Step 2: Re-run the evidence-producing commands**

```bash
npm run test:security:repositories
npm run verify
```

Expected: outputs match the documented scores/status. If coverage remains below 70%, F3.14 remains partial and the exact metrics are recorded.

- [ ] **Step 3: Validate Hyperdrive wording**

Confirm the audit distinguishes local contract/dry-run evidence from real deployed staging smoke. Expected: F2.14/F3.17 remain partial until a Cloudflare receipt exists.

- [ ] **Step 4: Update the roadmap only from observed evidence**

Expected: password revocation may close only if mutation and required evidence meet its item wording; coverage and Hyperdrive remain partial when their gates are absent.

- [ ] **Step 5: Commit evidence reconciliation**

```bash
git add .gitignore docs/superpowers/audits/2026-08-15-f2-14-hyperdrive-contract.md docs/superpowers/audits/2026-08-15-f3-14-verify-runner.md docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md
git commit -m "docs(roadmap): reconcile recovery evidence"
```

Expected: `reports/mutation/` no longer appears in `git status --short`.

### Task 7: Create canonical planning registry

**Files:**
- Create: `docs/superpowers/plans/INDEX.md`

- [ ] **Step 1: Write the registry**

The index must contain these explicit classes:

```markdown
# Synkroo Planning Index

## Canonical
- Product/architecture: ../specs/2026-07-28-synkroo-canonical-product-architecture.md
- Program design: ../specs/2026-08-16-roadmap-143-goal-program-design.md
- Program execution: 2026-08-16-roadmap-143-master-implementation.md
- Current reconciliation: 2026-08-15-synkroo-roadmap-pendencias-master-plan.md

## Source snapshot
- 2026-07-28-synkroo-development-master-plan.md — original 143 unchecked requirements; IDs are owned by the current reconciliation.

## Active wave plans
- 2026-08-16-roadmap-143-wave-0-recovery.md
- 2026-08-16-roadmap-143-wave-1-foundation.md
- 2026-08-16-roadmap-143-wave-2-clinical.md
- 2026-08-16-roadmap-143-wave-3-channels-ai.md
- 2026-08-16-roadmap-143-wave-4-business-lgpd.md
- 2026-08-16-roadmap-143-wave-5-release-pilot.md

## Historical
All other plans remain research/evidence unless a canonical document links them as an active dependency. Their unchecked boxes do not create duplicate backlog.
```

- [ ] **Step 2: Verify links**

Run a Markdown link/path checker or a Node script using `fs.existsSync` for every local path. Expected: zero missing canonical/active targets.

- [ ] **Step 3: Commit the registry**

```bash
git add docs/superpowers/plans/INDEX.md
git commit -m "docs(plans): define canonical roadmap index"
```

### Task 8: Implement the 143-item ledger generator

**Files:**
- Create: `scripts/roadmap-ledger.mjs`
- Create: `scripts/__tests__/roadmap-ledger.test.mjs`
- Modify: `package.json`
- Create on explicit apply: `docs/superpowers/audits/roadmap-143-ledger.json`

- [ ] **Step 1: Write the failing parser tests**

Tests must prove:

```javascript
import assert from 'node:assert/strict'
import test from 'node:test'
import { parseRoadmapTable, validateRoadmapRows } from '../roadmap-ledger.mjs'

const header = '| ID | Phase | Status | Requirement from roadmap | Blocking condition | Evidence source / next gate |\n|---|---|---|---|---|---|\n'
const row = '| F0.01 | F0 | DEFERRED | Freeze | decision record needed | W0 gate |\n'

test('parses six-column roadmap rows', () => {
  assert.deepEqual(parseRoadmapTable(header + row), [{
    id: 'F0.01', phase: 'F0', status: 'DEFERRED', requirement: 'Freeze', blocker: 'decision record needed', gate: 'W0 gate',
  }])
})

test('rejects duplicate IDs', () => {
  assert.throws(() => validateRoadmapRows(parseRoadmapTable(header + row + row), 2), /duplicate roadmap ID F0.01/)
})

test('rejects VERIFIED rows without nominal evidence', () => {
  const verified = row.replace('DEFERRED', 'VERIFIED').replace('W0 gate', 'none')
  assert.throws(() => validateRoadmapRows(parseRoadmapTable(header + verified), 1), /VERIFIED item F0.01 has no evidence/)
})
```

- [ ] **Step 2: Run RED**

```bash
node --test scripts/__tests__/roadmap-ledger.test.mjs
```

Expected: fail because `roadmap-ledger.mjs` does not exist.

- [ ] **Step 3: Implement the import-safe CLI**

Implement exports `parseRoadmapTable(markdown)`, `validateRoadmapRows(rows, expectedCount)` and `buildLedger(rows)`. Requirements:

- parse only lines matching `^\| F\d+\.\d{2} \|`;
- require six columns;
- require allowed statuses `VERIFIED`, `PARTIAL`, `OPEN`, `EXTERNAL`, `DEFERRED`, `UNVERIFIED`;
- reject duplicates;
- require exactly 143 rows in the real file;
- reject `VERIFIED` when evidence/gate is `none`, empty or only a generic wave gate;
- default CLI is read-only `--check`;
- `--write` is explicit and writes stable pretty JSON;
- print counts but never environment values.

CLI commands:

```bash
node scripts/roadmap-ledger.mjs --check
node scripts/roadmap-ledger.mjs --write
```

- [ ] **Step 4: Run GREEN**

```bash
node --test scripts/__tests__/roadmap-ledger.test.mjs
node scripts/roadmap-ledger.mjs --check
```

Expected: tests pass; check prints `records=143 unique=143` and status counts.

- [ ] **Step 5: Add scripts**

Add to `package.json`:

```json
"roadmap:check": "node scripts/roadmap-ledger.mjs --check",
"roadmap:write": "node scripts/roadmap-ledger.mjs --write"
```

- [ ] **Step 6: Generate and commit the ledger**

```bash
npm run roadmap:write
git add scripts/roadmap-ledger.mjs scripts/__tests__/roadmap-ledger.test.mjs package.json docs/superpowers/audits/roadmap-143-ledger.json
git commit -m "feat(program): add validated roadmap ledger"
```

### Task 9: Create blocker registry and restart contract

**Files:**
- Create: `docs/superpowers/audits/roadmap-143-blockers.md`
- Create: `docs/goals/roadmap-143-resume.md`

- [ ] **Step 1: Seed blocker registry**

Include rows for email normalization duplicates, Hyperdrive staging, coverage, auth mutation, finance races, CI remote, provider sandboxes, secret rotation, migrations, pilot resources and outage drills. Each row has class R1–R5, owning IDs, preflight, fallback, human action, receipt and READY alternatives.

- [ ] **Step 2: Write restart contract**

Use exact sections:

```markdown
# Roadmap 143 Resume
- Last verified goal: O0-G-ledger
- Current wave: O1
- Next READY goal: first dependency-free package in wave-1-foundation.md
- Active blockers: read roadmap-143-blockers.md
- Ledger: ../superpowers/audits/roadmap-143-ledger.json
- Required resume sequence: task_resume → roadmap:check → git status --short → reissue one /goal
- Global completion: 143/143 VERIFIED + hard gates + score >=90 + GO
```

- [ ] **Step 3: Verify restart paths and commit**

```bash
npm run roadmap:check
git add docs/superpowers/audits/roadmap-143-blockers.md docs/goals/roadmap-143-resume.md
git commit -m "docs(program): add blocker and resume contracts"
```

### Task 10: Run Gate R

**Files:**
- Modify: `docs/superpowers/audits/2026-08-16-o0-working-tree-inventory.md`
- Modify: `docs/goals/roadmap-143-resume.md`

- [ ] **Step 1: Run local gates**

```bash
git diff --check
npm run roadmap:check
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:integration:run
npm run test:security -- --runInBand
npm run test:release
```

Expected: all commands except the already-known global coverage stage exit 0; any failure is fixed or recorded as an R1/R2 blocker before O1.

- [ ] **Step 2: Verify recovery invariants**

```bash
git status --short
git log --oneline -8
```

Expected:

- no unclassified source/test change;
- generated mutation reports ignored;
- ledger has 143 unique records;
- canonical index links exist;
- resume file names the next READY goal;
- recovery commits are separated by cluster.

- [ ] **Step 3: Independent review**

Reviewer confirms no existing user work was lost, no evidence was overstated and no historical checkbox was added as duplicate backlog.

- [ ] **Step 4: Score O0**

Required: at least 9/10 and zero blocker/high finding. Attach commands, outputs, commits, risks and rollback to the inventory.

- [ ] **Step 5: Commit Gate R evidence**

```bash
git add docs/superpowers/audits/2026-08-16-o0-working-tree-inventory.md docs/goals/roadmap-143-resume.md
git commit -m "docs(program): close roadmap recovery gate"
```
