# O1-G02 — Git decisions and reproducible baseline

Date: 2026-08-20
Roadmap IDs: F1.01–F1.08
Goal: O1-G02 git-baseline

## Repository metadata

- Branch: `main`
- HEAD before baseline commands: `4b0e7a57cd06e40be8f49dcb725bf615e98dc40c`
- `AGENTS.md` SHA-256: `dc0dd71db6189caab446cec9c371c1b3e98ff1b3`
- Working tree before this goal: clean
- No ref, history, merge or rebase operation was executed.

## Local ancestry receipt

The four commits named by O1 are contained in `main`:

| Expected commit | `git branch --contains` |
|---|---|
| `70839ad8` | `main` |
| `e3a9c134` | `main` |
| `4234263e` | `main` |
| `4cbe3cac` | `main` |

## PR #6 receipt

`gh auth status` was available; raw auth output was suppressed. Sanitized `gh pr view 6 --json number,state,headRefName,baseRefName,commits,mergeable,url` returned:

- Number: 6
- State: `OPEN`
- Head: `fix/rbac-seed-bootstrap-and-menu-dedupe`
- Base: `main`
- Mergeable: `CONFLICTING`
- Commit count: 100
- URL: `https://github.com/kust-projetos/synkroo/pull/6`

## Merge/rebase decision

**N/A — expected content is already present in `main`.** The four expected ancestry commits are reachable from `main`, while PR #6 is open and conflicting. No merge, rebase, recreate, push or history rewrite was performed merely to close a checkbox. PR #6 remains an owner/GitHub decision item and is not treated as a local failure.

## Baseline commands

The baseline ran against HEAD `4b0e7a57` with sanitized logs under `.tmp/o1-g02-baseline/`:

| Command | Result |
|---|---|
| `npm run lint` | PASS, exit 0 |
| `npm run typecheck` | PASS, exit 0 |
| `npm test -- --runInBand` | PASS — 245 suites, 1618 passed, 5 pre-existing skips |
| `TEST_DATABASE_URL` set to validated loopback `synkroo_test`; `npm run test:integration:run` | R2 BLOCKER — 34 suites passed, 1 failed; 201/202 tests; `src/modules/followup/__tests__/cron/integration.test.ts` exceeded the 10-second Jest timeout while the sanitized log also observed an API rate-limit action. |
| `npm run build` | PASS — compiled successfully in 119s |
| `npm run build:cf` | PASS — compiled successfully in 30.8s |

## Baseline blocker R2

The integration failure is not treated as a green baseline or a code waiver. Reproduce with the same loopback runner after a clean DB/test-process start, isolate the followup cron timeout/rate-limit interaction, and add a focused regression before promoting F1.06/F1.08. No remote DB or provider was touched.

Rollback is the owning local commit revert; no merge/rebase state exists to abort. Preserve `.tmp/o1-g02-baseline/` as ignored local receipt only. After the R2 blocker is resolved and the six-command baseline is green, update `docs/goals/roadmap-143-resume.md` to O1-G03 or the first dependency-free goal.

## R2 root-cause resolution — 2026-08-20

- Reproduction: the valid cron integration case used the default `tasks=all`, which iterated every active clinic and called `buildCronContext` for each task; the test also mocked outdated service paths, so real inactive/campaign/hot-lead work ran. The send-suite `API rate limited` message was an expected non-failing log, not the timeout cause.
- Fix: `src/modules/followup/__tests__/cron/integration.test.ts` now mocks the exact action service boundaries and bounds the valid success request to `tasks=followups`. Production cron handler, rate-limit utility, global Jest timeout and skip policy were not changed.
- Proof: focused cron suite passed 6/6 twice; full loopback integration passed 35 suites/203 tests twice (36.342s and 34.003s). `npm run typecheck` and `npm run lint` remained green.
- Risk/rollback: the test no longer exercises all cron tasks in the valid success case; those task-specific paths remain covered by the dedicated query test and service suites. Revert the owning test commit to restore the prior fixture; no production rollback is needed.
- Classification: the O1-G02 integration R2 blocker is resolved for the baseline. F1.06/F1.08 can proceed to their next item-level evidence; O1-G03 is now the next READY goal.
