# F2.11 — Auth.js signOut server-side revocation

`authOptions.events.signOut` now calls `revokeUserSession(token.id)`, which increments persisted `sessionVersion`. Missing token IDs are ignored safely. This invalidates stolen JWTs after server-side signOut; password-change mutation remains absent/open and access/deactivation mutations already increment the version.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/auth/__tests__/signout-revocation.test.ts --runInBand` | PASS — 2 testes |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint auth/repository/testes | PASS |
| `git diff --check` | PASS |
