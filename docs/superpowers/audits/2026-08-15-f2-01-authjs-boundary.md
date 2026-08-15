# F2.01 — Auth.js boundary

- Legacy login/logout routes return 404.
- `authOptions` has one Credentials provider and JWT session strategy.
- JWT clinic updates require explicit `userClinicAccess`; forged clinic switch remains unchanged.

| Verificação | Resultado |
|---|---|
| `npx jest src/app/api/auth/__tests__/jwt-auth.test.ts --runInBand` | PASS — 5 testes |
