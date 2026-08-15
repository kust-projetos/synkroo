# F2.03–F2.08 — Core actions integration

The safe integration runner applied migrations and executed `src/modules/core/actions/__tests__/integration.test.ts` against the loopback-only `synkroo_test` database.

Result: **1 suite, 14 tests passed** covering tenant-scoped reads, RBAC denial, owner anti-lockout, idempotent owner reassignment, access removal/deactivation, role creation and module contracts. No credential or database URL value is recorded.

Residual: inbound webhook tenant derivation and all cross-domain concurrency scenarios remain separately gated.
