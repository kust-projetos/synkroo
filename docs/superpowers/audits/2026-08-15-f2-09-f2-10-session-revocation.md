# F2.09/F2.10 — Session revocation boundary

- `getUserProfile` rejects inactive persisted profiles.
- `getUserProfile` rejects JWT `sessionVersion` different from the persisted profile.
- `requireActiveProfile` repeats the version check before returning an authenticated profile.

| Verificação | Resultado |
|---|---|
| `npx jest src/lib/auth/__tests__/session.revocation.test.ts --runInBand` | PASS — 3 testes |
| `npx tsc --noEmit --pretty false` | PASS |

This artifact does not claim F2.11 (automatic bump after every password/role/access mutation); that mutation inventory remains separate.
