# O1-G05 — Security regression gate

Date: 2026-08-20
Roadmap IDs: F2.01, F2.02, F2.09, F2.10, F2.12, F2.13, F2.15–F2.18
Status: local regression green; external provider/staging receipts remain outside this gate.

## Receipts

| Command | Result |
|---|---|
| `npm run test:security -- --runInBand` | PASS — 9 suites/142 tests; focused coverage 95.22% statements, 90.81% branches, 95.23% functions, 96.33% lines |
| `DATABASE_URL` set to validated loopback `synkroo_test`; `RUN_INTEGRATION_TESTS=1 npm run test:security:integration` | PASS — 4 suites/38 tests; focused coverage 98.7% statements |
| `TEST_DATABASE_URL` set to validated loopback `synkroo_test`; `npm run test:integration:run` | PASS — 36 suites/206 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, zero warnings |

## Boundary coverage

- NextAuth/session boundary, disabled-user/session revocation and production signup 404 remain green in focused security suites.
- Audit payload allowlist/nested PII, exact public routes, CSRF/Origin, internal redirect handling and empty permission fallback remain green.
- Asaas webhook transaction and tenant/race fixtures remain green in security/integration suites; real provider sandbox/deployment evidence remains external.
- Core Actions trusted clinic/role/user predicates and treatment item/plan transaction tests are included in the 36-suite integration receipt.
- Adversarial dimensions checked by existing contracts include Unicode/internal redirect confusion, route-prefix bypass, webhook replay/credential binding, nested PII and missing permission data.

## Residual gates

- F2.11 remains partial for broader logout/role/access mutation coverage and auth residual mutants; repository mutation target is green but not a global coverage closure.
- F2.14/F3.17 deployed Hyperdrive smoke remains owner-authorized external work.
- F2.13/F6/F9 provider sandbox, timeout/replay and cost-boundary receipts remain external.
- Global coverage remains below 70%; this focused security gate does not override F3.14.
- No production, secret rotation, provider login, real data import or irreversible action was executed.

## Rollback

No production files changed in this audit-only goal. Revert the audit commit if the receipt is found inaccurate; revert owning code commits for any future regression fix. Do not promote roadmap statuses from this gate alone; attach item-level evidence and external receipts where required.
