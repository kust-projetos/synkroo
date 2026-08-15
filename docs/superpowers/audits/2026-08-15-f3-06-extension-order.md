# F3.06 — Extension migration order

Fresh migrations now create `vector` before the first `vector(1536)` column. The existing `0001` migration already creates `btree_gist` before its `EXCLUDE USING gist` constraint. A static Node test protects both orderings without opening a database.

| Verificação | Resultado |
|---|---|
| `node --test scripts/__tests__/migration-extension-order.test.mjs` | PASS — 1 teste |
| `git diff --check` | PASS |

Residual: applying migrations against owner-controlled environments remains blocked; no database was mutated.
