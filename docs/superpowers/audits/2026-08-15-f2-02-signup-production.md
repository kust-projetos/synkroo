# F2.02 — Signup production disabled

## Implementação

- `src/app/api/auth/signup/route.ts` retorna `404` antes de ler body ou chamar repository quando `NODE_ENV=production`.
- `src/middleware.ts` retorna `404` para `/signup` e `/api/auth/signup` em production, evitando exposição por rota pública ou redirect ambíguo.
- Fora de production, o endpoint mantém o comportamento de conflito de conta existente.

## Evidência

| Verificação | Resultado |
|---|---|
| `npx jest src/app/api/auth/signup/route.test.ts src/__tests__/middleware.signup.test.ts --runInBand` | PASS — 3 testes |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `git diff --check` | PASS |
