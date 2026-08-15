# F3.03 — Production AUTH_SECRET startup gate

`getEnv()` rejects production when AUTH_SECRET is absent or shorter than 32 characters and accepts exactly the minimum test value. Tests use placeholders only; no real secret was read or recorded.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/__tests__/env.test.ts --runInBand` | PASS — 3 testes |
