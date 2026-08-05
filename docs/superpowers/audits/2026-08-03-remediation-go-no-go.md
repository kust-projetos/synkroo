# Remediation Go/No-Go

**Decision:** NO-GO
**Evidence date:** 2026-08-05
**Candidate:** `97f98bc6`

## Evidence matrix

| Gate | Result | Evidence |
|---|---|---|
| lint | PASS | `npm run lint` |
| typecheck | PASS | `npm run typecheck` |
| unit | PASS | 226 suites, 1535 passed, 5 skipped |
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
| integration/PostgreSQL | PASS | Isolated PostgreSQL provisioned and migrated; 29 suites and 191 tests passed, including Asaas replay, clinic switch, idempotency/outbox races |
| E2E deterministic setup | PASS | deterministic seed now provisions `clinica-demo` and credentials; full runner reaches test execution |
| E2E twice | PASS (local production build) | Fresh production build plus full Playwright matrix passed twice consecutively: 235/235 each run, one worker, authenticated + unauthenticated + API projects |
| staging smoke | NOT RUN | no approved staging URL/resource IDs/secrets |
| Worker rollback | NOT RUN | remote mutation requires owner approval |

## REM traceability

| Requirement | State | Evidence/remaining gap |
|---|---|---|
| REM-01 | PASS | confirmation/inbound inputs reject payload tenant |
| REM-02 | PASS | scoped handlers plus real PostgreSQL integration coverage pass |
| REM-03 | PASS | channel installation + hashed secret resolver |
| REM-04 | PASS (local) | PostgreSQL concurrent Asaas delivery settles one payment and stores one event; integration test passes |
| REM-05 | PASS | canonical NextAuth session boundary delegates to `requireActiveProfile`; active/inactive/stale/DB-failure tests pass; manual login/logout endpoints removed |
| REM-06 | PASS | Action audit allowlist |
| REM-07 | PASS (local) | atomic claim and outbox concurrency/retry tests pass against local PostgreSQL; staging/provider delivery remains pending |
| REM-08 | PASS (local) | stable charge create/cancel and campaign execution idempotency keys; unique clinic+budget charge constraint and local tests pass |
| REM-09 | PASS | due campaign query requires `scheduled_at <= now` |
| REM-10 | PASS (local) | Auth.js JWT update accepts explicit second-clinic access and rejects inaccessible clinic in PostgreSQL integration test |
| REM-11 | PASS | CSV formula neutralization |
| REM-12 | PASS | dashboard removes fabricated fallback/activity |
| REM-13 | PASS | responsive code plus 360px contacts/finance/a11y E2E: 4/4 passed |
| REM-14 | PASS (local) | canonical callback/fixtures pass; fresh production-build Playwright matrix passes 235/235 twice consecutively; staging remains pending |
| REM-15 | NO-GO | integration and E2E are green; staging smoke and rollback remain blocked by missing approved resources/approval |

## Automatic No-Go reasons

- Staging deployment, smoke and rollback were not authorized or executed.
- Wrangler startup analyzer remains blocked by tool error.
- Provider delivery and staging execution remain unproven; local evidence is not a production substitute.

Production deploy is prohibited. Required next evidence: owner-approved staging resources, smoke and rollback rehearsal.

## Evidence-based release rubric

This score is a release aid, not a substitute for hard gates. Any automatic No-Go reason
keeps the final decision at No-Go regardless of points.

| Dimension | Weight | Score | Evidence basis |
|---|---:|---:|---|
| Tenancy, webhook and audit P0 | 25 | 25 | Two-tenant fixtures, inbound/action integration, PostgreSQL Asaas replay and audit allowlist pass |
| Auth, idempotency and outbox | 20 | 17 | Revocation, multi-clinic JWT update, atomic claim, outbox concurrency/retry and stable side-effect keys pass locally; provider delivery pending |
| Structural hardening | 15 | 15 | Headers, CSV, consent, embeddings, architecture and dependency gates pass |
| Product and E2E | 20 | 20 | Fresh production-build Playwright matrix passes twice consecutively (235/235 each run); no skipped execution |
| Cloudflare and release operations | 20 | 8 | Build/dry-run pass with known duplicate-case warning; startup analyzer, staging and rollback pending |
| **Total** | **100** | **85** | **NO-GO** |

**Decision thresholds:** `GO` requires at least 90/100 and every hard gate green; `CONDITIONAL`
requires 75–89 with a written owner-approved exception; anything below 75 is `NO-GO`. Current
77/100 is therefore No-Go. The score must be recalculated after each missing evidence item is
executed; no points are awarded for planned or locally simulated staging evidence.
