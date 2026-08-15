# F2.14 — Bounded DB health tool primitive

Added `runDbHealthCheck(query)`, an injectable primitive for the bridge's future DB-backed health tool. It returns only `{ok:true}` after the query resolves and propagates query failures without swallowing them.

| Verificação | Resultado |
|---|---|
| `npx jest src/core/agent-bridge/__tests__/db-health.test.ts --runInBand` | PASS — 2 testes |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint focused | PASS |
| `git diff --check` | PASS |

Residual: wiring this primitive into the Cloudflare bridge RPC remains the next step.
