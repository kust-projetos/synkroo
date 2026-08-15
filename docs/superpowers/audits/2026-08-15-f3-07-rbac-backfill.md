# F3.07 — RBAC backfill CLI seguro

- `backfill(client, { dryRun })` é exportado e não abre conexão ao importar.
- `parseArgs([])` retorna dry-run; somente `--apply` permite persistência.
- Backfill é idempotente, cria Owner/presets/Agente e não inclui `master:*` no Owner.

| Verificação | Resultado |
|---|---|
| fake PG + policy invariants | PASS — 17 testes |
| CLI contract tests | PASS — 2 testes |
| ESLint nos scripts alterados | PASS |
| `git diff --check` | PASS |
