# Remediation Go/No-Go

**Decision:** NO-GO
**Evidence date:** 2026-08-04
**Candidate:** `fabc6adf`

## Evidence matrix

| Gate | Result | Evidence |
|---|---|---|
| lint | PASS | `npm run lint` |
| typecheck | PASS | `npm run typecheck` |
| unit | PASS | 223 suites, 1539 passed |
| security | PASS | `npm run test:security`, 142 passed, 95.06% statements |
| mutation | PASS | Stryker 91.98%, threshold 70% |
| build | PASS | `npm run build` |
| dependency production audit | PASS | 0 high/critical; 1 low dev/toolchain advisory (`esbuild`) |
| full-history secrets | PASS | `gitleaks detect --source . --log-opts='--all'`, no leaks |
| docs links | PASS | `node scripts/check-doc-links.mjs` |
| Cloudflare config contract | PASS | `src/__tests__/cloudflare/*` |
| W4 mobile/a11y contracts | PARTIAL | finance and accessibility focused E2E pass; contacts-mobile blocked on seeded contact detail API |
| OpenNext build + Wrangler dry-run | PASS WITH WARNING | WSL build and dry-run pass; duplicate-case warning recorded |
| Wrangler startup check | BLOCKED | Wrangler 4.114 alpha fails ByteString conversion on generated non-ASCII worker |
| integration/PostgreSQL | BLOCKED | no approved local `TEST_DATABASE_URL`; run timed out against unavailable DB |
| E2E deterministic setup | PARTIAL | canonical NextAuth callback + mandatory SEED_SECRET fixture setup; current run is blocked when local DB health hangs, with no silent fallback |
| E2E twice | NOT PROVEN | prerequisite full run failed |
| staging smoke | NOT RUN | no approved staging URL/resource IDs/secrets |
| Worker rollback | NOT RUN | remote mutation requires owner approval |

## REM traceability

| Requirement | State | Evidence/remaining gap |
|---|---|---|
| REM-01 | PASS | confirmation/inbound inputs reject payload tenant |
| REM-02 | PARTIAL | scoped handlers exist; DB integration not run |
| REM-03 | PASS | channel installation + hashed secret resolver |
| REM-04 | PARTIAL | Asaas transaction implemented; replay not proven on PostgreSQL |
| REM-05 | PASS | active profile + session version guard; manual login/logout endpoints removed |
| REM-06 | PASS | Action audit allowlist |
| REM-07 | PARTIAL | atomic claim/outbox primitives; charge/campaign migration incomplete |
| REM-08 | PARTIAL | outbox retry/dead-letter primitive; provider integration not staged |
| REM-09 | PASS | due campaign query requires `scheduled_at <= now` |
| REM-10 | PARTIAL | NextAuth update path + cache clear; multi-clinic DB proof pending |
| REM-11 | PASS | CSV formula neutralization |
| REM-12 | PASS | dashboard removes fabricated fallback/activity |
| REM-13 | PARTIAL | responsive code added; 360px E2E not proven |
| REM-14 | PARTIAL | canonical callback setup is fail-fast; 3 focused W4 E2E pass, contacts mobile and full suite remain red |
| REM-15 | NO-GO | blocked until integration, E2E, staging and rollback evidence |

## Automatic No-Go reasons

- Integration gate cannot run without approved disposable PostgreSQL.
- Full E2E setup does not reach dashboard consistently.
- Staging deployment, smoke and rollback were not authorized or executed.
- Wrangler startup analyzer remains blocked by tool error.
- Charge/campaign effects now use stable idempotency keys; transactional outbox wiring and concurrent DB proof remain pending.

Production deploy is prohibited. Required next evidence: owner-approved staging resources, disposable DB, two consecutive full E2E passes, outbox integration tests, smoke and rollback rehearsal.
