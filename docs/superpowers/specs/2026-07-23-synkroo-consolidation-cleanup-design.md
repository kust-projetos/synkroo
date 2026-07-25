# Synkroo Consolidation and Cleanup Design

**Date:** 2026-07-23
**Status:** Approved for implementation planning
**Canonical repository:** `D:\projetos\synkroo`
**Target branch:** `main`

## Context

Synkroo has 95 registered Git worktrees, 29 branches not ancestral to `origin/main`, and 14 dirty worktrees. Some branches contain current product work; others contain superseded implementations, experiments, generated output, or incomplete work. Cleanup must preserve every exclusive change before any branch, worktree, or file is removed.

`D:\projetos\agencia-synkroo` is a separate project and is outside this design.

## Goals

- Establish `D:\projetos\synkroo` as the only active Synkroo application workspace.
- Promote a verified consolidated result to Git branch `main`.
- Preserve valid, current behavior while rejecting redundant or superseded work.
- Remove generated, local, stale, and obsolete files from the active Git tree.
- Keep every destructive step reversible for at least 30 days.

## Non-goals

- Rewriting Synkroo from scratch.
- Merging every branch or dirty worktree.
- Changing product scope or module architecture during cleanup.
- Integrating experimental spikes into production code.
- Modifying `agencia-synkroo`.
- Pushing `main`, deleting remote branches, or releasing without explicit authorization.

## Requirements

- **REQ-01 (ubiquitous):** The consolidation process shall preserve all committed and uncommitted exclusive content before cleanup.
- **REQ-02 (event-driven):** When a branch is evaluated, the process shall compare patch equivalence, tree differences, dependencies, tests, and current behavior before assigning a decision.
- **REQ-03 (unwanted):** If an item is dirty, experimental, ambiguous, or failing tests, then the process shall quarantine it instead of deleting or merging it automatically.
- **REQ-04 (state-driven):** While validation gates are failing or incomplete, the process shall not promote the consolidation branch to `main`.
- **REQ-05 (event-driven):** When generated output is reproducible from tracked source and configuration, the process shall remove it from the Git index and retain its ignore rule.
- **REQ-06 (event-driven):** When equivalent behavior already exists in the candidate branch, the process shall reject the redundant branch rather than merge duplicate history.
- **REQ-07 (unwanted):** If secret scanning identifies committed sensitive material, then the process shall stop promotion, remove exposure, and require credential rotation where applicable.
- **REQ-08 (ubiquitous):** The final repository shall have one active workspace, a clean `main`, no generated build output tracked, and documented rollback evidence.
- **REQ-09 (state-driven):** While quarantine is within its 30-day retention period, the process shall retain bundles, patches, untracked archives, manifests, and branch mapping.
- **REQ-10 (event-driven):** When the retention period expires and validation remains green, the process shall permit removal of redundant worktrees and branches after explicit approval.

## Evidence Baseline

| Metric | Observed state |
|---|---:|
| Registered worktrees | 95 |
| Clean worktrees | 81 |
| Dirty worktrees | 14 |
| Branches ancestral to `origin/main` | 66 |
| Branches not ancestral to `origin/main` | 29 |
| Detached worktree heads | 1 |
| Branches ancestral to candidate | 21 |
| Maximal branch heads | 8 |
| Tracked `.open-next` files | 116 (~19.2 MB) |
| Tracked `.playwright-mcp` files | 31 |
| CRM focused verification | 7 failed, 40 passed |
| Agent bridge allowlist verification | 27 passed |
| Lint/typecheck baseline | Incomplete: exceeded 180 seconds |

## Canonical Candidate

`chore/atendimento-eixo2-implementation` is the consolidation candidate because it contains `origin/main`, is 244 commits ahead of it, and contains 21 otherwise unmerged branches. It is not promoted directly because its current worktree is dirty and its CRM work-in-progress fails tests.

Consolidation shall occur on a temporary branch created from a verified reference. The temporary branch is a reversible integration mechanism; final active branch remains `main`.

## Decision Ledger

### Branches

| Item | Decision | Evidence | Confidence |
|---|---|---|---|
| `chore/atendimento-eixo2-implementation` | Keep as base candidate | Contains `origin/main`; +244 commits; broadest productive lineage | High |
| `feat/eixo2-task1-allowlist` | Semantic merge | Candidate has policy definitions but bridge execution/listing does not enforce them | High |
| `fix/security-integrity-hardening` | Selective merge | Valid CI/database/env isolation changes coexist with stale or superseded changes | High |
| `fix/instagram-webhook-raw-bytes` | Reject as redundant | `git cherry` reports patch equivalence with candidate | High |
| Local `main` | Reject as independent input | Fully ancestral to candidate; local untracked files are generated reports | High |
| 21 candidate ancestors | Do not merge individually | Already contained in candidate lineage | High |
| 66 clean branches merged to `origin/main` | Remove after gates | No independent committed content | High |
| `feat/seed-local-scale` | Quarantine | Unique 1,584-line scale seed, but schema is older than current migrations | Medium |
| `spike/cf-runtime` | Quarantine then remove | Runtime direction later implemented by selected Cloudflare commits | High |
| `spike/ia-opennext-binding` | Quarantine then remove | Commit explicitly marks implementation disposable and non-mergeable | High |
| Other `spike/*` | Preserve conclusions only | Research/reference value; no automatic production merge | Medium |

### Current CRM Work-in-progress

| Finding | Decision |
|---|---|
| Six modified CRM files and two untracked documents | Protect and finish before integration |
| Owner actions exported but omitted from `registerActions` | Block promotion |
| Tests configure different mocks from implementation dependencies | Repair tests through TDD |
| Focused result: 7 failures, 40 passes | Treat as WIP, not valid consolidated behavior |

### Dirty Worktrees

| Group | Decision |
|---|---|
| Current CRM candidate | Protect, correct, verify, then integrate |
| Local `main` logs/reports | Archive evidence, then discard generated output |
| Four Cloudflare driver variants | Preserve patches, then discard superseded experiments |
| Old LGPD and segmentation work | Preserve patches, then discard after verifying later implementations/tests |
| `schema-drift-recovery` | Preserve patch, then reject obsolete pre-rebaseline migration work |
| `migrate-scheduler` and restore-test worktrees | Quarantine; compare remaining unique files before removal |
| Old RBAC foundation worktree | Quarantine; no wholesale merge |
| Dirty spike worktrees | Preserve research conclusions; discard runtime state and build output |

### Repository Files

| Item | Decision | Reason |
|---|---|---|
| `.open-next/` | Untrack and regenerate | Produced by `npm run build:cf` |
| `.playwright-mcp/` | Untrack and remove | Old local browser snapshots already ignored |
| `.claude/settings.local.json` | Untrack | Local permissions file already ignored |
| `.ec-events` | Remove | Empty tracked runtime artifact |
| `preview.pid` | Remove and ignore | Process-local runtime state |
| `CTempmigrate-err.txt` | Remove | Invalid empty temporary path artifact |
| Wrangler state, reports, logs, temp directories | Remove and ignore | Reproducible or local-only output |
| Ten unreferenced ad-hoc scripts | Remove after archive snapshot | Initial debug scripts with no callers |
| `e2e/TEST_REPORT.md` | Remove | Stale March report that no longer proves current state |
| `start-agents.bat` | Remove | References obsolete `worker1` peer workflow |
| `_bmad/` | Remove | Unreferenced legacy tool configuration |
| `.superpowers/brainstorm/` | Archive decisions, remove generated HTML | Old visual session output without active references |
| `archive/planning-v0.3` | Preserve immutable history | Current specs cite archive instead of active legacy tree |
| Root `worker-configuration.d.ts` | Reproduce, then likely untrack | Generated and excluded from root TypeScript build |
| Worker-specific `worker-configuration.d.ts` files | Keep | Included by worker-specific TypeScript projects |
| `AGENTS.md` and `CLAUDE.md` | Keep | Intentional compatibility files despite duplicate content |
| `ux-analysis.md` | Archive or remove | Initial analysis superseded by current UX documentation |

## Stale Content Corrections

Cleanup includes targeted corrections where stale text can mislead operations:

- Replace Supabase CLI instructions in `src/app/api/admin/run-migration/route.ts` with current Drizzle policy.
- Rename or rewrite obsolete Supabase auth test mocks/documentation when no Supabase dependency remains.
- Update legacy-planning references to the canonical roadmap or archived Git reference.
- Replace deprecated `next lint` with the supported ESLint CLI while preserving boundary rules.

These corrections are independent commits and must not be bundled with branch deletion.

## Consolidation Flow

1. Freeze creation of branches and worktrees.
2. Create a Git bundle containing every reference.
3. Export binary patches and untracked archives from all dirty worktrees.
4. Store sensitive local files separately without adding them to Git.
5. Generate SHA-256 manifests for every backup artifact.
6. Create a temporary consolidation branch from a verified base.
7. Restore and finish candidate CRM work through failing tests first.
8. Apply allowlist behavior semantically, retaining stronger tests.
9. Apply only verified security/CI changes from the security branch.
10. Compare quarantined productive candidates using `git cherry`, `git range-diff`, tree diffs, and focused tests.
11. Commit repository hygiene separately from behavioral integration.
12. Run all quality and security gates.
13. Promote the verified result to `main` only after approval.
14. Check out `main` at `D:\projetos\synkroo` and verify a clean tree.
15. Retain quarantine artifacts for 30 days.
16. Remove redundant worktrees and branches only after retention and approval.

## Validation Gates

| Gate | Command/evidence | Required result |
|---|---|---|
| Clean install | `npm ci` | Exit 0 |
| Lint | supported ESLint CLI | Exit 0 |
| TypeScript | `npm run typecheck` | Exit 0 |
| Unit tests | `npm test -- --runInBand` | Exit 0 |
| Integration | `npm run test:integration:run` | Exit 0 against isolated PostgreSQL |
| Next build | `npm run build` | Exit 0 |
| Cloudflare build | `npm run build:cf` | Exit 0 from clean generated directories |
| Worker typechecks | IA bridge and IA agent scripts | Exit 0 |
| Secret scan | `gitleaks detect` or equivalent | No unresolved findings |
| Git hygiene | ignored-tracked and artifact scans | Zero generated/local files tracked |
| Branch audit | branch/worktree ledger | Zero unclassified exclusive changes |
| Final status | `git status --short --branch` | Clean `main` |

## Rollback

Rollback uses immutable backup evidence rather than reflog alone:

- Full Git bundle restores committed references.
- Per-worktree binary patches restore tracked modifications.
- Untracked archives restore files absent from Git.
- SHA-256 manifests prove backup integrity.
- A pre-promotion tag identifies the original canonical state.
- Hygiene, behavior integration, documentation, and branch cleanup use separate commits.
- Failed validation resets only the temporary consolidation branch; original worktrees remain untouched until promotion succeeds.
- Remote deletion and protected-branch push require explicit approval.

## Acceptance Criteria

- `D:\projetos\synkroo` is the only active Synkroo application workspace.
- Active checkout is `main` with a clean working tree.
- No exclusive committed or uncommitted content is lost.
- CRM WIP and allowlist behavior have focused green tests.
- Selective security/CI corrections are verified without wholesale stale merges.
- Generated build, browser, process, and local settings artifacts are absent from the Git index.
- Secret scan has no unresolved findings.
- Install, lint, typecheck, unit, integration, Next build, and Cloudflare build gates pass.
- Backup and quarantine artifacts remain available for 30 days.
- Branch/worktree removal has an auditable ledger and explicit approval.
