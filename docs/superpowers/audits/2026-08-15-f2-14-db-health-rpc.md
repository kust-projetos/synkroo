# F2.14 — Hyperdrive-backed `dbHealth` RPC

`AppService.dbHealth()` now validates the bridge runtime contract, uses the injected Hyperdrive connection through shared Drizzle, executes only `SELECT 1`, and returns the bounded `{ok:true}` result from `runDbHealthCheck`. It never returns database rows.

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint bridge/primitive | PASS |
| `git diff --check` | PASS |

Residual: worker-level RPC smoke/deployment was not executed; no external action was taken.
