# F2.11 — Transactional session revocation primitive

`revokeUserSession(userId)` increments `users.sessionVersion` atomically in a single update and updates the timestamp. It is reusable by logout and administrative mutations. Auth.js event wiring remains the next F2.11 step.

| Verificação | Resultado |
|---|---|
| `npx jest src/repositories/auth/__tests__/revocation.test.ts --runInBand` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint no repository/teste | PASS |
| `git diff --check` | PASS |
