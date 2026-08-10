# Remediation Go/No-Go

**Decision:** GO
**Evidence date:** 2026-08-10
**Candidate:** remediation working tree on `main` (post-canary evidence)

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
| Wrangler startup check | PASS | `npx wrangler check startup --config wrangler.toml --env staging`; profile generated and startup phase analyzed |
| integration/PostgreSQL | PASS | Isolated PostgreSQL provisioned and migrated; 29 suites and 191 tests passed, including Asaas replay, clinic switch, idempotency/outbox races |
| E2E deterministic setup | PASS | deterministic seed now provisions `clinica-demo` and credentials; full runner reaches test execution |
| E2E twice | PASS (local production build) | Fresh production build plus full Playwright matrix passed twice consecutively: 230/230 each run, one worker, authenticated + unauthenticated + API projects; E2E no-op catches/tautological assertions removed |
| production deployment/provider canary | PASS | Wrangler version `d32ec7df-b88f-422f-a7b8-65595f995716`; production health 20/20 with DB ok; `/login` 200; Evolution status Connected/LoggedIn HTTP 200; authorized sandbox outbound HTTP success with webhook callback HTTP 200; invalid webhook token rejected 403 |
| staging smoke | PASS | authenticated smoke passed 4 consecutive runs after `Pool maxUses=1`; health probe passed 20/20; all 10 smoke checks passed per run |
| Worker rollback | PASS | rollback rehearsal to `ed30d0f9-406b-4279-a3cb-bec7d06bef90` succeeded, health returned 200, then candidate `36879cea-cf7c-4154-bf6d-d02a948c97c3` was restored and smoke passed |

## REM traceability

| Requirement | State | Evidence/remaining gap |
|---|---|---|
| REM-01 | PASS | confirmation/inbound inputs reject payload tenant |
| REM-02 | PASS | scoped handlers plus real PostgreSQL integration coverage pass |
| REM-03 | PASS | Asaas webhook resolves tenant from verified provider credential; request clinic query/header is ignored; route regression passes |
| REM-04 | PASS | PostgreSQL concurrent Asaas delivery settles one payment and stores one event; actual sandbox PAYMENT_CREATED callback plus official-header settlement/replay passed |
| REM-05 | PASS | canonical NextAuth session boundary delegates to `requireActiveProfile`; active/inactive/stale/DB-failure tests pass; manual login/logout endpoints removed |
| REM-06 | PASS | Action audit allowlist |
| REM-07 | PASS | atomic claim and outbox concurrency/retry tests pass against local PostgreSQL; synthetic staging smoke and rollback also pass |
| REM-08 | PASS (local) | stable charge create/cancel and campaign execution idempotency keys; unique clinic+budget charge constraint and local tests pass |
| REM-09 | PASS | due campaign query requires `scheduled_at <= now` |
| REM-10 | PASS (local) | Auth.js JWT update accepts explicit second-clinic access and rejects inaccessible clinic in PostgreSQL integration test |
| REM-11 | PASS | CSV formula neutralization |
| REM-12 | PASS | dashboard removes fabricated fallback/activity |
| REM-13 | PASS | responsive code plus 360px contacts/finance/a11y E2E: 4/4 passed |
| REM-14 | PASS | canonical callback/fixtures pass; fresh production-build Playwright matrix passes 230/230 twice consecutively after strict no-op removal; authenticated staging smoke passes |
| REM-15 | PASS (production canary) | Evolution Go status Connected/LoggedIn HTTP 200; authorized outbound canary returned HTTP success; production webhook callback returned HTTP 200; production invalid-token probe returned 403. |

## Automatic No-Go reasons

- Asaas sandbox API, configuration and an actual `PAYMENT_CREATED` callback passed; settlement/replay also passed through the official header.
- WhatsApp/Evolution credentials, service paths and staging callback are configured; one owner-authorized outbound canary to the connected sandbox number returned HTTP 200, and the Evolution VPS logged both message delivery and staging webhook HTTP 200.
- Production approval was explicitly granted on 2026-08-10; deployment and provider canary evidence are recorded below.
- The final review record is present at `docs/superpowers/audits/2026-08-05-final-review-record.md`; it explicitly preserves this boundary.

Production deployment completed as authorized: Worker version `d32ec7df-b88f-422f-a7b8-65595f995716`; health probes passed 20/20; Evolution outbound and production webhook canary passed. Rollback remains available via Wrangler version rollback.

## Evidence-based release rubric

This score is a release aid, not a substitute for hard gates. Any automatic No-Go reason
keeps the final decision at No-Go regardless of points.

| Dimension | Weight | Score | Evidence basis |
|---|---:|---:|---|
| Tenancy, webhook and audit P0 | 25 | 25 | Two-tenant fixtures, inbound/action integration, PostgreSQL Asaas replay and audit allowlist pass |
| Auth, idempotency and outbox | 20 | 20 | Revocation, multi-clinic JWT update, atomic claim, outbox concurrency/retry, Asaas sandbox API/callback, stable side-effect keys and authorized Evolution outbound callback pass |
| Structural hardening | 15 | 15 | Headers, CSV, consent, embeddings, architecture and dependency gates pass |
| Product and E2E | 20 | 20 | Fresh production-build Playwright matrix passes twice consecutively (230/230 each run); no skipped execution |
| Cloudflare and release operations | 20 | 20 | OpenNext/dry-run, startup analysis, production deployment version `d32ec7df-b88f-422f-a7b8-65595f995716`, 20/20 health checks, protected-route redirects, Evolution status, outbound canary with production webhook HTTP 200, invalid-token 403 and rollback readiness pass |
| **Total** | **100** | **100** | **GO** |

**Decision thresholds:** `GO` requires at least 90/100 and every hard gate green; `CONDITIONAL`
requires 75–89 with a written owner-approved exception; anything below 75 is `NO-GO`. Current
100/100 is GO: owner authorization, production deployment, health, provider status, outbound canary and production webhook validation are complete.
No rollback was required; Wrangler version `d32ec7df-b88f-422f-a7b8-65595f995716` remains the rollback target.

## Auditor remediation pass — 2026-08-08

The implementation gaps identified by the independent auditor are closed in the working tree. Financial charges and campaign delivery now create PostgreSQL outbox jobs transactionally before provider calls; fail-closed architecture/content contracts and violating fixtures were added; E2E silent no-ops were removed; and the legacy `redactInput` API/tests were deleted.

Final verification and production authorization update: `npx next build --no-lint` and `npm run build:cf` pass; `npm run typecheck`, changed-file ESLint, focused remediation Jest (6 suites/27 tests), PostgreSQL integration (4 suites/5 tests), and `git diff --check` pass. The full production Playwright matrix passes twice consecutively at 230/230 each run with one worker and two retries configured. Production Worker version `d32ec7df-b88f-422f-a7b8-65595f995716` deployed successfully; health passed 20/20 with database checks; Evolution Go reported Connected/LoggedIn; authorized sandbox outbound delivery and production webhook callback returned HTTP 200; invalid webhook token returned 403. Rubric is now 100/100 GO.
