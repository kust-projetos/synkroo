# O1-G03 — Tenant-scoped Core Actions and races

Date: 2026-08-20
Roadmap IDs: F2.03–F2.08
Status: `EVIDENCE_PENDING` — RED matrix exists; fail-closed implementation is not yet complete.

## Matrix

| Action | Scenario | Expected | Current receipt |
|---|---|---|---|
| `assignUserAccess` | trusted context clinic A, payload clinic B, user from A, role from B | forbidden; zero access row in B | RED: action returns `ok=true` before scope enforcement |
| `createRole` | trusted context clinic A, payload clinic B | forbidden; no role in B | RED: action returns `ok=true` before scope enforcement |
| `removeUserAccess` | trusted context clinic A, payload clinic B, user from A | forbidden; no foreign deletion | RED matrix assertion fails before scope enforcement |
| `deactivateUser` | trusted context clinic A, payload clinic B, user from A | forbidden; user remains active | RED matrix assertion fails before scope enforcement |
| `setModuleContract` | global/master action | explicit master permission and idempotent final module state | Existing happy-path coverage; tenant contract remains separate |
| read actions | context clinic scope | only trusted clinic rows | Existing integration coverage passes |
| anti-lockout | last Owner downgrade/remove/deactivate | conflict and unchanged Owner access | Existing integration coverage passes |
| duplicate/no-op | Owner→Owner access assignment | stable no-op | Existing integration coverage passes |
| concurrency | two foreign-scope mutations in one matrix run | deterministic forbidden results and zero foreign mutation | RED matrix uses `Promise.all`; implementation still trusts payload scope |

## RED receipt

Command, repeated twice against the isolated loopback `synkroo_test` database:

```text
TEST_DATABASE_URL set to validated loopback `synkroo_test` (value not printed) npm run test:integration:run -- src/modules/core/actions/__tests__/integration.test.ts --runInBand
```

Both runs: 14 existing scenarios passed; the new foreign-scope matrix failed at its forbidden assertion (`expected false`, received `true`). No production change has been made for this RED proof.

## Root cause hypothesis

Action handlers for `assignUserAccess`, `removeUserAccess`, `deactivateUser` and `createRole` pass payload scope directly to services and do not compare it with trusted `ctx.clinicId`. The service/repository layer therefore cannot enforce the action context boundary for these inputs. `setModuleContract` is a master/global operation and requires separate permission/idempotency proof.

## Required GREEN work

- Pass trusted `ActionContext` into the mutating action boundary.
- Reject `input.clinicId !== ctx.clinicId` with canonical `forbidden` before repository access.
- Add repository predicates for user/role/entity ownership and clinic scope.
- Add duplicate/idempotency and two-concurrent-update tests for each mutating action.
- Run the matrix twice, repository mutation target and independent review before changing F2.03–F2.08 status.

## Risk and rollback

Risk: accepting payload-controlled clinic scope can grant, remove or deactivate access across tenants. Rollback is revert of the owning action/test commit; database effects use isolated `synkroo_test` fixtures and are cleaned by test teardown. No production or external provider action was executed.

## GREEN receipt — 2026-08-20

- `assertClinicScope(input.clinicId, ctx)` now runs before `assignUserAccess`, `removeUserAccess`, `deactivateUser` and `createRole` services.
- `setModuleContract` remains a global/master action and was not given a tenant guard.
- Core Actions matrix: 15/15 scenarios passed in two consecutive loopback runs; foreign scope returns `forbidden` and creates zero foreign access/role mutation.
- `npm run typecheck`: PASS. `npm run lint`: PASS. LSP: six changed files clean.

## Residual classification

F2.03–F2.08 remain `EVIDENCE_PENDING`: repository predicates for foreign role/user/entity, treatment-item ownership, duplicate POST idempotency and two concurrent updates for every mutating action still require their own matrix. The current commit proves trusted clinic context only.

## Risk and rollback

Risk is reduced at the action boundary but not closed across every repository/entity path. Rollback is revert of the helper/handler/test commit; isolated test fixtures are cleaned by teardown. No production or external provider action was executed.

## Next action

Continue the O1-G03 RED matrix for entity ownership, duplicate/idempotency and concurrent final-state invariants before any roadmap status promotion.

## Entity/race GREEN receipt — 2026-08-20

- `assignUserAccess` now verifies both user clinic and role clinic before upsert; `removeUserAccess` and `deactivateUser` reject absent/foreign users before mutation.
- Foreign role and foreign user cases plus the existing foreign clinic batch pass 15/15 twice; foreign access/role rows are not created.
- `npm run typecheck`, `npm run lint` and LSP remain green.
- Repository mutation target remains 70.97% (88 killed, 35 survived, 1 no-coverage, 2 timed-out mutants); the current Stryker configuration mutates four repository files and does not include Core Action repositories, so this is not an Action mutation closure.
- Residual: duplicate POST/idempotency and two concurrent same-entity updates across every action still need dedicated proof. F2.03–F2.08 remain `EVIDENCE_PENDING`.
- Rollback: revert the owner/service/test commit; isolated fixtures are cleaned by teardown and no production data was changed.

## Idempotency/race receipt — 2026-08-20

- Duplicate Owner→Owner assignment remains a single `(user_id, clinic_id)` row.
- Two concurrent assignments to the same user/clinic/role both complete successfully, final role is `recepRoleId`, and `users.sessionVersion` increases by exactly two.
- Core matrix with this proof passes 16/16 twice; the first warm-up attempt had a transient fixture failure and was not counted as green. Clean double-run is the authoritative receipt.
- F2.03–F2.08 remain `EVIDENCE_PENDING` because duplicate/idempotency and concurrency proof is not yet present for every mutating action/entity, and the current mutation configuration excludes Core Action repositories.
- Rollback remains revert of the owning repository/service/test commit; no production action occurred.

## Treatment ownership residual — 2026-08-20

- Existing proof: 2 suites/12 tests pass for service conversion/progress/errors and sessions route auth/validation.
- Missing real integration scenarios: patient from another clinic, item from another treatment plan, plan/item ID mutation without trusted clinic context, duplicate session completion, and two concurrent completions with deterministic `completedSessions`/status.
- Structural gap: `findByPatient` filters clinic, but `findById`, `update`, `updateItem`, `getProgress` and delete paths accept IDs without clinic/plan ownership predicates; `updateSessionProgress` performs item update, progress read and plan updates outside one transaction.
- Risk: cross-tenant treatment read/write or lost/over-counted sessions. Rollback is revert of the future treatment ownership commit; no production data was changed.
- Next goal: add PostgreSQL fixtures for two clinics/plans/items, RED ownership/race assertions, then implement repository predicates and one transaction before any F2.07/F2.08 promotion.
