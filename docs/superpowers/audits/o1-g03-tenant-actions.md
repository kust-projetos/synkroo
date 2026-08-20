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

## Next action

Keep O1-G03 `EVIDENCE_PENDING`. Implement the trusted-context boundary in the owning action/service lane, rerun the RED matrix as GREEN and preserve all failing test names if another boundary is found.
