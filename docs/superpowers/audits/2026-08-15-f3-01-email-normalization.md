# F3.01 — E-mail normalizado por clínica

## Implementação

- `normalizeEmail` centraliza `trim()` + `toLowerCase()`.
- `emailSchema`, signup repository, duplicate lookup e NextAuth credentials usam a boundary.
- O Drizzle schema representa `users_clinic_email_uniq` como `(clinic_id, lower(btrim(email)))`.
- Migration gerada por Drizzle: `src/lib/db/migrations/0022_far_stature.sql`.
- A migration faz preflight de colisões normalizadas, aborta sem apagar usuários, normaliza linhas seguras e só então recria o índice.

## Evidência

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/validations/__tests__/common.test.ts --runInBand` | PASS — 2 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `git diff --check` | PASS |
| `scripts/integration-run.mjs` em banco isolado `synkroo_test` | PASS — migration, seed e 2 testes DB |
| Prova SQL temporária do índice de expressão | PASS — rejeita same-clinic case/whitespace e aceita cross-clinic |

## Bloqueio conservador

`npm run db:migrate` no banco de desenvolvimento existente não aplicou a migration anterior de unicidade porque o preflight encontrou um grupo duplicado. Nenhum usuário foi apagado ou mesclado; o banco de desenvolvimento permanece BLOCKED até remediação aprovada pelo owner. A validação de migration foi feita somente no banco isolado `synkroo_test`.
