# F2.14 — Hyperdrive bridge contract

The ia-bridge runtime contract now requires `HYPERDRIVE.connectionString` together with `HANDLE_SECRET` and `IA_SEEN`. Bridge validation injects that connection string into the shared Drizzle client before RPC dependencies are built, preventing silent fallback to the app process environment.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/__tests__/runtime-env.test.ts --runInBand` | PASS — 3 testes |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint focused | PASS |
| `git diff --check` | PASS |

Residual: a DB-backed bridge tool and worker-level Hyperdrive smoke remain open.
