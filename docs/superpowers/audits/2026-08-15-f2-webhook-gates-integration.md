# F2.06/F2.15/F2.16 — Atendimento webhook gates integration

The safe integration runner executed `src/modules/atendimento/__tests__/gates/integration.test.ts` against loopback-only `synkroo_test` after applying current migrations.

Result: **1 suite, 29 tests passed**. Evidence includes unknown installation rejection, invalid/missing secret rejection, enabled/disabled route gates, webhook signature policy, and duplicate inbound persistence exactly once. No credential or URL value is recorded.

Residual: provider-level external smoke and broader cross-domain concurrency remain separate gates.
