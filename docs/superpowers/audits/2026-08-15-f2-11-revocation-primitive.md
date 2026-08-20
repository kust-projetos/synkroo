# F2.11 — Transactional session revocation primitive

`revokeUserSession(userId)` increments `users.sessionVersion` atomically in a single update and updates the timestamp. It is reusable by logout and administrative mutations. Auth.js event wiring remains the next F2.11 step.

| Verificação | Resultado |
|---|---|
| `npx jest src/repositories/auth/__tests__/revocation.test.ts --runInBand` | PASS |
| `npx tsc --noEmit --pretty false` | PASS |
| ESLint no repository/teste | PASS |
| `git diff --check` | PASS |

## 2026-08-15 password-change follow-up

- Implementation: `changeUserPassword(userId, currentPassword, nextPassword)` now locks the credential row, verifies the current password, updates the hash and increments `users.session_version` in one transaction.
- HTTP flow: `src/app/api/auth/change-password/route.ts` validates the authenticated session and password payload, then calls the transactional primitive; `route.test.ts` covers 200/403/400/401.
- Guard evidence: `session.revocation.test.ts` covers stale `sessionVersion` rejection; targeted revocation + change-password route run passed 2 suites / 5 tests. LSP diagnostics are clean in all six changed TypeScript source/test files.
- PostgreSQL/concurrency evidence: PASS — two consecutive runs of the isolated `synkroo_test` runner completed migrations, deterministic seed and `password-change.integration.test.ts`: 1 suite / 2 tests per run. The suite proves hash replacement, `sessionVersion + 1` and at-most-one success for concurrent requests using the same current password. The broader 35-suite integration run is not claimed as green: 34 suites / 188 tests passed, while 14 tests timed out in hooks at 10 seconds (E12).
- Mutation evidence: AUTH/REPOSITORY TARGET EXECUTED with Stryker JSON report. The 124-mutant repository target reached 70.16% (35 survivors); the overall target passes the break threshold 70 and thresholds/mutation scope were not reduced. Auth-specific survivors remain and F2.11 stays `PARTIAL` until their intended coverage is resolved.
- Remaining action: keep F2.11 `PARTIAL` because auth-specific survivors remain; the password revocation guard mutation is covered and the repository-wide F2.19 mutation gate is now green.
