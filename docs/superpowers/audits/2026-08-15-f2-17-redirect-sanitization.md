# F2.17 — Redirect interno sanitizado

- `sanitizeInternalRedirect` aceita apenas paths iniciados por `/`, rejeita `//`, backslash e URLs/protocolos externos.
- `src/app/login/page.tsx` usa a função antes de chamar `router.push`.
- Destino inválido retorna `/dashboard`.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/auth/__tests__/redirect.test.ts --runInBand` | PASS — 8 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `git diff --check` | PASS |
