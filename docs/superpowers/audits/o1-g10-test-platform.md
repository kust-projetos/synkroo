# O1-G10 — Test platform, coverage and CI baseline

Date: 2026-08-20
Roadmap IDs: F2.11, F3.14
Status: baseline captured; release gate remains NO-GO until test regression and coverage are repaired.

## Coverage receipt

Command: `npm test -- --coverage --runInBand`

- Result: **failed** — 244 suites passed, 1 failed; 1,609 tests passed, 10 failed, 5 skipped.
- Failing suite: `src/modules/core/services/__tests__/access-service.test.ts`.
- Root error: mocked `accessRepo` lacks `getUserRoleScope`, producing `TypeError` before the expected `ActionError` assertions.
- Generated `coverage/coverage-summary.json` metrics:
  - Statements: **52.06%** (7,606/14,608)
  - Branches: **36.53%** (1,950/5,338)
  - Lines: **53.22%** (7,100/13,340)
  - Functions: **39.92%** (1,004/2,515)
- The global Jest thresholds remain 70% for all four dimensions. No exclusion or threshold was changed.

## Gate comparison

`jest.config.js` collects `src/**/*.ts`, excluding declarations, tests and all `.tsx`. `scripts/verify.mjs` runs lint, app/worker typechecks, coverage and release contracts, but does not itself run integration, security, build, production E2E or Wrangler. CI runs those additional gates separately, so local `verify` and CI are not equivalent yet.

## Current verification

- `npm run verify` — failed at coverage with the same access-service mock regression; lint and typechecks completed before the failure.
- The failure is actionable: update the access-service test repository mock to include the current `getUserRoleScope` contract, then rerun the focused suite and full coverage.
- Coverage work must prioritize the failed auth/tenancy tests and largest uncovered critical modules (Actions, migrations, finance, LGPD, outbox and agent side effects) without weakening measurement.

## Residual gates

F2.11/F3.14 remain open. The 70% gate is not satisfied, test suite is not green, and verify/CI parity requires an explicit owner-approved change. This audit records baseline evidence only; it does not authorize CI push, staging, production E2E or external provider actions.
