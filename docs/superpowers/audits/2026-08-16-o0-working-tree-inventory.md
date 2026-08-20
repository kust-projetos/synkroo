# O0 Working Tree Inventory

Date: 2026-08-16
Plan: `docs/superpowers/plans/2026-08-16-roadmap-143-wave-0-recovery.md` Task 1

## Immutable baseline

| Field | Captured value |
|---|---|
| HEAD | `89748dcf6dd4b282a421bf1f1091dcb437da682a` |
| Branch | `main` |
| Tracked modifications | 9 paths |
| Untracked status roots | 8 paths, expanding to 10 files |
| Tracked diff | 9 files, 188 insertions, 71 deletions |
| `git diff --check` | exit 0 |
| Line-ending warning | The reconciled roadmap is currently CRLF and Git warns it will become LF when touched; preserve content and review the eventual normalization diff. |

The working-tree entries match the snapshot recorded by the O0 plan. The expected difference in repository metadata is that the program plans are now committed at `89748dcf`; they are not pending working-tree paths.

## Captured status before this inventory

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

## One-path-one-disposition inventory

The table uses status roots exactly as Git reports them. Directory roots are expanded in the manifest below, but remain one inventory row so a path cannot be assigned to two clusters.

| Cluster | Path | State | Roadmap ownership | Disposition |
|---|---|---|---|---|
| Auth revocation/password | `docs/superpowers/audits/2026-08-15-f2-11-revocation-primitive.md` | modified | F2.11, F2.19 | Verify with cluster A; update only from nominal test and mutation receipts; commit with cluster A. |
| Hyperdrive evidence | `docs/superpowers/audits/2026-08-15-f2-14-hyperdrive-contract.md` | modified | F2.14, F3.17 | Reconcile in O0 Task 6; keep PARTIAL until an authorized staging receipt proves the DB-backed tool and runtime lifecycle. |
| Verify/coverage evidence | `docs/superpowers/audits/2026-08-15-f3-14-verify-runner.md` | modified | F3.14 | Reconcile in O0 Task 6; do not mark VERIFIED until fresh global coverage meets the configured gate. |
| Roadmap reconciliation | `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md` | modified | All affected canonical IDs | Commit only after owning cluster evidence is accepted; review the CRLF-to-LF warning before staging. |
| Seed idempotency | `scripts/seed-test-clinic.mjs` | modified | F3.13, F3.15 support | Verify and commit with cluster B only. |
| Auth revocation/password | `src/repositories/auth/__tests__/integration.test.ts` | modified | F2.11 | Run focused repository integration tests; commit with cluster A only. |
| Auth revocation/password | `src/repositories/auth/__tests__/revocation.test.ts` | modified | F2.11 | Run focused revocation tests; commit with cluster A only. |
| Auth revocation/password | `src/repositories/auth/index.ts` | modified | F2.11 | Verify password mutation, session-version revocation and concurrency; commit with cluster A only. |
| Auth revocation/password | `stryker.repositories.config.json` | modified | F2.19 | Run the focused mutation target and verify threshold without exclusions; commit with cluster A only. |
| Mutation reports | `reports/` | untracked directory, 2 files, 544117 bytes | Generated evidence for F2.19 | Do not commit HTML/JSON. Extract reproducible metrics into the owning audit, then leave generated output ignored or remove only after evidence is preserved and deletion is authorized by the plan. |
| Seed idempotency | `scripts/__tests__/seed-test-clinic-idempotency.test.mjs` | untracked file | F3.13, F3.15 support | Verify with Node test and dry-run; commit with cluster B only. |
| Auth revocation/password | `src/app/api/auth/change-password/` | untracked directory, 2 files | F2.11 | Run route unit tests plus repository integration/concurrency; commit with cluster A only. |
| Verify/coverage evidence | `src/lib/__tests__/validation.test.ts` | untracked file | F3.14 support | Keep with the test-platform/coverage owner; do not use it to lower or bypass the global threshold. |
| Action route | `src/lib/api/__tests__/action-route.test.ts` | untracked file | F4.02, F4.03 | Verify canonical success/failure envelope and request ID; commit with cluster C only. |
| Action route | `src/lib/api/action-route.ts` | untracked file | F4.02, F4.03 | Verify boundary types and focused tests; commit with cluster C only. |
| Auth revocation/password | `src/repositories/auth/__tests__/password-change.integration.test.ts` | untracked file | F2.11 | Run real PostgreSQL password/revocation/concurrency test; commit with cluster A only. |
| Treatment plan tests | `src/services/treatment-plans/__tests__/` | untracked directory, 1 file | F5.05 | Verify service behavior and ownership; commit with cluster D only or record a reproducible blocker. |
| Recovery control | `docs/superpowers/audits/2026-08-16-o0-working-tree-inventory.md` | untracked file created by O0 Task 1 | O0 control artifact | Validate coverage against current status and commit this file alone before touching clusters A–D. |

## Expanded untracked manifest

| Status root | Expanded file | Bytes | SHA-256 prefix | Assigned cluster |
|---|---|---:|---|---|
| reports | mutation HTML report | included in root total | generated | Mutation reports |
| reports | mutation JSON report | included in root total | generated | Mutation reports |
| seed test | seed idempotency Node test | 331 | `82c20ce95379` | Seed idempotency |
| change-password | route test | 2391 | `579649f148ff` | Auth revocation/password |
| change-password | route source | 1319 | `61d78465b6f8` | Auth revocation/password |
| validation | validation test | 4110 | `8672632fc1c0` | Verify/coverage evidence |
| action-route | adapter test | 1270 | `66cc9bde9153` | Action route |
| action-route | adapter source | 1173 | `2e8b712b108c` | Action route |
| password-change | PostgreSQL integration test | 3326 | `5537df5f5c77` | Auth revocation/password |
| treatment-plans | service test | 8008 | `c6f674b243ec` | Treatment plan tests |

The generated report filenames and hashes are intentionally omitted from the durable inventory because the directory must not be committed and its contents are regenerated by the mutation command.

## Safety review

- A bounded scan covered 19 changed or untracked text files for private-key markers, AWS/GitHub/Bearer token shapes and concrete assignments to the project's named secret variables.
- Candidate secret values: 0.
- Unclassified tracked paths: 0.
- Unclassified untracked files after directory expansion: 0.
- No file other than this inventory was modified while collecting the evidence.

## Gate R receipt — 2026-08-20

Commands and results:

| Command | Result |
|---|---|
| `git diff --check` | PASS |
| `npm run roadmap:check` | PASS — 143 records, 143 unique; 3 DEFERRED, 14 EXTERNAL, 65 PARTIAL, 39 UNVERIFIED, 22 VERIFIED |
| `npm run lint` | PASS — zero warnings |
| `npm run typecheck` | PASS |
| `npm test -- --runInBand` | PASS — 245 suites, 1618 passed, 5 pre-existing skips |
| `TEST_DATABASE_URL=<loopback synkroo_test> npm run test:integration:run` | PASS — 35 suites, 202 tests |
| `npm run test:security -- --runInBand` | PASS — 9 suites, 142 tests; focused coverage 95.22/90.81/95.23/96.33 |
| `npm run test:release` | PASS — 13 tests |
| Gate R invariant validator | PASS — score 10/10 |

Recovery commits are separated by cluster: inventory `c883dbe1`, auth `81ed9608`, seed `2981e6da`, Action/validation `34a7757b`, treatment `0e4dfb87`, evidence reconciliation `b8e27231`, planning index `4d71567c`, ledger `bd3fe999`, blocker/resume `da4fbcd1`.

Residual risks are not hidden: global coverage remains below 70%; F2.11 retains auth mutation survivors; Cloudflare staging, provider sandboxes, secret rotation, owner migrations and pilot actions remain in the blocker registry. Rollback is the owning commit revert or documented roll-forward/restore procedure; no production or irreversible action was executed.

## Gate R decision

O0 scores `10/10` and is READY to hand off to O1. Next independent goal: `O1-G01-incident-controls`. The ledger remains the only status authority; no item is promoted by this wave gate alone.
