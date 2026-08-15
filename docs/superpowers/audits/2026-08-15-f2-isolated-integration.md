# F2 — Isolated database integration tranche

The safe `scripts/integration-run.mjs` runner applied migrations through 0023 and seeded the loopback-only `synkroo_test` database. No development/production database was used and no credential/URL value is recorded here.

Suites:

- `src/repositories/auth/__tests__/integration.test.ts`
- `src/modules/financeiro/gateways/__tests__/asaas-webhook.integration.test.ts`
- `src/core/actions/__tests__/integration.test.ts`

Result: **3 suites, 7 tests passed** in 9.211 seconds. This proves isolated DB integration for the selected flows; it does not by itself prove concurrent race behavior unless a suite explicitly exercises it.
