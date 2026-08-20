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
- Guard evidence: `session.revocation.test.ts` plus direct `revokeUserSession` PostgreSQL assertion; targeted revocation + change-password route run passed 2 suites / 6 tests. LSP diagnostics are clean in all six changed TypeScript source/test files.
- PostgreSQL/concurrency evidence: PASS — standalone `password-change.integration.test.ts` passed migrations, deterministic seed and 2 tests; same-password race permits exactly one success. A combined auth integration filter remains R2-flaky (E113) and is not claimed green.
- Mutation evidence: O1-G04 rerun covered 124 mutants with 88 killed, 35 survived and 1 no-coverage: 70.97%, above break threshold 70. The revocation-critical line 157 survivor was killed by the direct sessionVersion assertion; auth residuals below are valid `createUserWithClinic`/access-projection branches, not revocation-critical. F2.11 remains `PARTIAL` until the wider logout/role/access requirement has nominal proof.
- Remaining action: keep F2.11 `PARTIAL`; repository F2.19 mutation gate is green, but residual signup/access mutants and combined auth integration instability remain documented.

## O1-G04 survivor classification — 2026-08-20

| Mutant ID | Status | Line | Mutator | Classification | Reason |
|---:|---|---:|---|---|---|
| 48 | Survived | 90 | ObjectLiteral | valid-residual | hasUserClinicAccess projection; no revocation mutation |
| 75 | Survived | 179 | MethodExpression | valid-residual | createUserWithClinic slug normalization |
| 77 | Survived | 182 | Regex | valid-residual | createUserWithClinic accent normalization |
| 78 | Survived | 182 | StringLiteral | valid-residual | createUserWithClinic accent normalization |
| 79 | Survived | 183 | Regex | valid-residual | createUserWithClinic slug character normalization |
| 80 | Survived | 183 | Regex | valid-residual | createUserWithClinic slug character normalization |
| 81 | Survived | 183 | StringLiteral | valid-residual | createUserWithClinic slug character normalization |
| 82 | Survived | 184 | Regex | valid-residual | createUserWithClinic slug edge trimming |
| 83 | Survived | 184 | Regex | valid-residual | createUserWithClinic slug edge trimming |
| 84 | Survived | 184 | StringLiteral | valid-residual | createUserWithClinic slug edge trimming |
| 87 | Survived | 193 | StringLiteral | valid-residual | clinic default phone fixture |
| 89 | Survived | 196 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 90 | Survived | 197 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 91 | Survived | 197 | StringLiteral | valid-residual | clinic business-hours defaults |
| 92 | Survived | 197 | StringLiteral | valid-residual | clinic business-hours defaults |
| 93 | Survived | 198 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 94 | Survived | 198 | StringLiteral | valid-residual | clinic business-hours defaults |
| 95 | Survived | 198 | StringLiteral | valid-residual | clinic business-hours defaults |
| 96 | Survived | 199 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 97 | Survived | 199 | StringLiteral | valid-residual | clinic business-hours defaults |
| 98 | Survived | 199 | StringLiteral | valid-residual | clinic business-hours defaults |
| 99 | Survived | 200 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 100 | Survived | 200 | StringLiteral | valid-residual | clinic business-hours defaults |
| 101 | Survived | 200 | StringLiteral | valid-residual | clinic business-hours defaults |
| 102 | Survived | 201 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 103 | Survived | 201 | StringLiteral | valid-residual | clinic business-hours defaults |
| 104 | Survived | 201 | StringLiteral | valid-residual | clinic business-hours defaults |
| 105 | Survived | 202 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 106 | Survived | 202 | StringLiteral | valid-residual | clinic business-hours defaults |
| 107 | Survived | 202 | StringLiteral | valid-residual | clinic business-hours defaults |
| 108 | Survived | 203 | ObjectLiteral | valid-residual | clinic business-hours defaults |
| 120 | Survived | 248 | ConditionalExpression | valid-residual | owner-role signup error branch |
| 121 | NoCoverage | 248 | StringLiteral | valid-residual | owner-role signup error branch has no direct coverage |

No generic waiver was used. The only revocation-critical survivor identified in this run was the sessionVersion SQL mutation at line 157; it is now killed by the direct PostgreSQL assertion. Residuals remain attached to signup/access scope and do not close F2.11 by themselves.
