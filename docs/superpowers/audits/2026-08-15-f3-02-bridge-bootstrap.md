# F3.02 — ia-bridge bootstrap wiring

`AppService` validates the bridge runtime schema before `ping`, `issueHandle`, and action dependency construction. Missing `HANDLE_SECRET` or `IA_SEEN` fails closed; validation reports field names only.

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit --pretty false` | PASS |
| `npx eslint src/workers/ia-bridge/index.ts` | PASS |
| `git diff --check` | PASS |

Residual: app/sidecar wiring and runtime smoke remain separate gates.
