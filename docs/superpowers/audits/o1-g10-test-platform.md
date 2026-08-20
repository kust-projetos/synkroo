# O1-G10 — Test platform, coverage and CI baseline

Date: 2026-08-20
Roadmap IDs: F2.11, F3.14
Status: regression fixed; release gate remains NO-GO until coverage reaches 70%.

## Coverage receipt

Command: `npm test -- --coverage --runInBand` after commit `564e8814`.

- Result: **245 suites passed**, 1,619 tests passed, 5 skipped; the command exits 1 only on global thresholds.
- The previous 10 access-service TypeErrors are resolved by the test-only mock alignment in `564e8814`.
- Current Jest metrics: statements **54.85%**, branches **40.44%**, lines **56.06%**, functions **42.93%**.
- The global Jest thresholds remain 70% for all four dimensions. No exclusion or threshold was changed.

## Gate comparison

`jest.config.js` collects `src/**/*.ts`, excluding declarations, tests and all `.tsx`. `scripts/verify.mjs` runs lint, app/worker typechecks, coverage and release contracts, but does not itself run integration, security, build, production E2E or Wrangler. CI runs those additional gates separately, so local `verify` and CI are not equivalent yet.

## Current verification

- `npm run verify` — reaches coverage with all 245 suites and 1,619 tests passing, then exits 1 because the global 70% threshold is unmet.
- The access-service mock regression is closed; the remaining blocker is structural coverage debt across critical modules.
- Coverage work must prioritize auth/tenancy, Actions, migrations, finance, LGPD, outbox and agent side effects without weakening measurement.

## Residual gates

F2.11/F3.14 remain open. The 70% gate is not satisfied, although the unit suite is green. Verify/CI parity also remains open because integration, security, build, production E2E and Wrangler are separate CI stages. This audit does not authorize CI push, staging, production E2E or external provider actions.
