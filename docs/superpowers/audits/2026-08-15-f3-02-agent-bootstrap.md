# F3.02 — ia-agent bootstrap wiring

`ia-agent` now calls `parseRuntimeEnv('agent', env)` in both the worker health fetch and the Durable Object constructor. Missing API/model/base URL/binding configuration fails closed; the parser reports only field names.

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit --pretty false` | PASS |
| `npx eslint src/workers/ia-agent/index.ts` | PASS |
| `git diff --check` | PASS |

Residual: bridge/app/sidecar wiring and runtime smoke remain separate gates.
