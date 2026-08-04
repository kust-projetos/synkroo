# Remediation Go/No-Go

**Decision:** NO-GO
**Evidence date:** 2026-08-04
**Candidate:** `767a813f`

## Evidence matrix

| Gate | Result | Evidence |
|---|---|---|
| lint | PASS | `npm run lint` |
| typecheck | PASS | `npm run typecheck` |
| unit | PASS | 224 suites, 1521 passed, 5 skipped |
| security | PASS | `npm run test:security`, 142 passed, 95.06% statements |
| mutation | PASS | Stryker 91.98%, threshold 70% |
| build | PASS | `npm run build` |
| dependency production audit | PASS | 0 high/critical; 1 low dev/toolchain advisory (`esbuild`) |
| full-history secrets | PASS | `gitleaks detect --source . --log-opts='--all'`, no leaks |
| docs links | PASS | `node scripts/check-doc-links.mjs` |
| Cloudflare config contract | PASS | `src/__tests__/cloudflare/*` |
| W4 mobile/a11y contracts | PASS | focused accessibility, finance and contacts-mobile run: 4/4 passed |
| OpenNext build + Wrangler dry-run | PASS WITH WARNING | OpenNext build and dry-run pass; duplicate-case warning recorded |
| remediation schema verifier | PASS | Local disposable PostgreSQL confirms `outbox_jobs` and `consents` columns and unique keys |
| Wrangler startup check | BLOCKED | Wrangler 4.114/4.118 alpha now fails `Failed to parse body as FormData` on generated worker; injected marker is ASCII-safe |
| integration/PostgreSQL | PASS | Disposable Docker PostgreSQL provisioned and migrated; 25 suites and 184 tests passed |
| E2E deterministic setup | PASS | deterministic seed now provisions `clinica-demo` and credentials; full runner reaches test execution |
| E2E twice | NOT PROVEN | full run reaches 239 tests but fails legacy dashboard/calendar assertions and times out before completion |
| staging smoke | NOT RUN | no approved staging URL/resource IDs/secrets |
| Worker rollback | NOT RUN | remote mutation requires owner approval |

## REM traceability

| Requirement | State | Evidence/remaining gap |
|---|---|---|
| REM-01 | PASS | confirmation/inbound inputs reject payload tenant |
| REM-02 | PASS | scoped handlers plus real PostgreSQL integration coverage pass |
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
| REM-13 | PASS | responsive code plus 360px contacts/finance/a11y E2E: 4/4 passed |
| REM-14 | PARTIAL | canonical callback/fixtures pass; full 241-test run remains red/interrupted by dev-server ECONNRESET and legacy journey assertions |
| REM-15 | NO-GO | blocked until integration, E2E, staging and rollback evidence |

## Automatic No-Go reasons

- Full E2E setup does not reach dashboard consistently.
- Staging deployment, smoke and rollback were not authorized or executed.
- Wrangler startup analyzer remains blocked by tool error.
- Charge/campaign effects now use stable idempotency keys; transactional outbox wiring and concurrent DB proof remain pending.

Production deploy is prohibited. Required next evidence: two consecutive full E2E passes, owner-approved staging resources, smoke and rollback rehearsal.

## Evidence-based release rubric

This score is a release aid, not a substitute for hard gates. Any automatic No-Go reason
keeps the final decision at No-Go regardless of points.

| Dimension | Weight | Score | Evidence basis |
|---|---:|---:|---|
| Tenancy, webhook and audit P0 | 25 | 22 | Database-backed two-tenant fixtures, schema verifier and inbound/action integration pass; Asaas replay proof remains pending |
| Auth, idempotency and outbox | 20 | 12 | Auth and mutation gates pass; provider/outbox concurrency proof pending |
| Structural hardening | 15 | 15 | Headers, CSV, consent and dependency gates pass |
| Product and E2E | 20 | 12 | Focused W4 contracts pass; full suite is not proven twice |
| Cloudflare and release operations | 20 | 8 | Build/dry-run pass with warning; startup, staging and rollback pending |
| **Total** | **100** | **69** | **NO-GO** |

**Decision thresholds:** `GO` requires at least 90/100 and every hard gate green; `CONDITIONAL`
requires 75–89 with a written owner-approved exception; anything below 75 is `NO-GO`. Current
69/100 is therefore No-Go. The score must be recalculated after each missing evidence item is
executed; no points are awarded for planned or locally simulated staging evidence.
