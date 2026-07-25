# Synkroo Consolidation and Cleanup Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
**Goal:** Consolidate valid Synkroo work into one verified `main` checkout at `D:\projetos\synkroo` without losing exclusive committed or uncommitted content.
**Architecture:** Preserve first; classify by semantic evidence; integrate on isolated branch; promote only after gates. Behavioral, hygiene, archive, and ref-cleanup commits remain separate and reversible.
**Tech Stack:** Git worktrees/bundles, Next.js 15, TypeScript 5.6, Jest, PostgreSQL/Drizzle, OpenNext/Wrangler, GitHub Actions, Gitleaks.
**Agent Orchestration:** Supervisor-Workers — read-only comparison/review may parallelize; backup, integration, cleanup, promotion, and deletion execute sequentially.
---
## Context
Current topology: 95 worktrees, 14 dirty, 29 branches outside `origin/main`. Candidate `chore/atendimento-eixo2-implementation` contains `origin/main` plus 244 commits, but CRM WIP fails 7 tests. Final state: one clean `main`, no generated files tracked, rollback assets retained 30 days.
## Stack
| Tool | Version | Purpose |
|---|---|---|
| Git | installed | refs, bundles, patches, worktrees |
| Node/npm | 20/lockfile | scripts, install, tests |
| Jest/PostgreSQL | 29.7/pgvector16 | behavior and integration |
| Wrangler | 4.101+ | Worker types/build |
| Gitleaks | Docker v8.24.2 | current tree + history scan |
## Architecture
```text
D:/projetos/
├── synkroo/                              # final main
├── _synkroo-consolidation-20260723/      # temporary
└── _synkroo-quarantine/2026-07-23/       # bundle, patches, archives, hashes
```
Rules: no cleanup before verified backup; no wholesale branch merges; no generated files in behavior commits; no ref deletion before approval; filesystem/tests outrank stale plans.
## Backup Manifest Schema
```text
path_hash<TAB>worktree_path<TAB>branch<TAB>head<TAB>dirty_entries
```
## Endpoint Delta
| Endpoint | Change |
|---|---|
| `POST /api/admin/run-migration` | Keep disabled; replace Supabase text with Drizzle CLI guidance |
| `POST /api/cron/crm-duplicates` | Complete existing per-clinic action contract if focused tests pass |
## Components
```text
integration/{crm-wip,ia-allowlist,security-ci}
hygiene/{artifacts,obsolete-tooling,historical-planning,generated-types}
promotion/{quality-gates,approval,main-normalization}
```
## Milestones
| Name | Days | Deliverable |
|---|---:|---|
| Preservation | 1 | verified bundle/patches/hashes |
| Integration | 1–2 | CRM, allowlist, selective CI commits |
| Hygiene | 1 | clean index and archive |
| Promotion | 1 | green gates and local `main` |
| Closure | +30 days | approved worktree/branch removal |
## Trade-offs
| Decision | Reason | Rejected |
|---|---|---|
| Candidate-based | broadest productive lineage | rebuild from `origin/main` |
| Semantic integration | avoids regressions | merge everything |
| External quarantine | clean and reversible | immediate deletion |
| Temporary worktree | protects root WIP | edit root directly |
## Tests
| Type | Tool | Scope | Gate |
|---|---|---|---|
| Unit/contract | Jest/node:test | CRM, allowlist, CI, admin, lint | RED first; green |
| Integration | Jest/PostgreSQL | tenant/CRM/migrations | green |
| Build/type | Next/OpenNext/tsc | app + Workers | green |
| Mutation | Stryker | security targets | ≥70% |
| Secret | Gitleaks | tree + history | no unresolved finding |
| E2E | existing ADR | no UI behavior added | deferred |
---
### Task 1: Freeze and Preflight
**Files:** Create `docs/superpowers/audits/2026-07-23-pre-consolidation-inventory.md`.
- [ ] Freeze new branches/worktrees; do not terminate active work.
- [ ] Refresh/read topology:
```bash
cd /d/projetos/synkroo
git fetch origin --prune
git status --short --branch
git remote -v
git worktree list --porcelain
```
- [ ] Generate inventory, but do not commit before backup:
```bash
AUDIT=docs/superpowers/audits/2026-07-23-pre-consolidation-inventory.md
{ echo '# Pre-consolidation Inventory'; echo '```text'; git remote -v; git branch -vv; git worktree list --porcelain; echo '```'; } > "$AUDIT"
git diff --check -- "$AUDIT"
```
Expected: all 95 worktrees represented. Rollback: remove only this new audit file.
### Task 2: Immutable Backup
**Files:** External `D:/projetos/_synkroo-quarantine/2026-07-23/**`.
- [ ] Create restricted storage and bundle all refs:
```bash
Q=/d/projetos/_synkroo-quarantine/2026-07-23
mkdir -p "$Q/worktrees" "$Q/sensitive"
cmd.exe /c 'icacls D:\projetos\_synkroo-quarantine\2026-07-23\sensitive /inheritance:r /grant:r %USERNAME%:(OI)(CI)F /T'
git show-ref > "$Q/refs.txt"
git bundle create "$Q/all-refs.bundle" --all
git bundle verify "$Q/all-refs.bundle"
```
- [ ] Export all dirty worktrees:
```bash
: > "$Q/worktrees.tsv"
while IFS= read -r WT; do
  STATUS=$(git -C "$WT" status --porcelain --untracked-files=all); [ -z "$STATUS" ] && continue
  ID=$(printf '%s' "$WT" | sha256sum | cut -c1-12); DIR="$Q/worktrees/$ID"; mkdir -p "$DIR"
  BRANCH=$(git -C "$WT" branch --show-current); [ -n "$BRANCH" ] || BRANCH='(detached)'
  printf '%s\t%s\t%s\t%s\t%s\n' "$ID" "$WT" "$BRANCH" "$(git -C "$WT" rev-parse HEAD)" "$(printf '%s\n' "$STATUS" | wc -l)" >> "$Q/worktrees.tsv"
  printf '%s\n' "$STATUS" > "$DIR/status.txt"
  git -C "$WT" diff --binary > "$DIR/tracked.patch"
  git -C "$WT" diff --cached --binary > "$DIR/staged.patch"
  git -C "$WT" ls-files --others --exclude-standard -z > "$DIR/untracked.list"
  [ ! -s "$DIR/untracked.list" ] || tar -C "$WT" --null -T "$DIR/untracked.list" -czf "$DIR/untracked.tar.gz"
done < <(git worktree list --porcelain | awk '/^worktree /{sub(/^worktree /,""); print}')
```
- [ ] Copy sensitive files without printing values; hash everything:
```bash
for F in .env.local .env.neon .dev.vars certificates/localhost.pem certificates/localhost-key.pem; do
  [ -f "$F" ] || continue; mkdir -p "$Q/sensitive/$(dirname "$F")"; cp -- "$F" "$Q/sensitive/$F"
done
(cd "$Q" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
(cd "$Q" && sha256sum -c SHA256SUMS)
test "$(wc -l < "$Q/worktrees.tsv")" -eq 14
```
Expected: bundle valid, all hashes `OK`, 14 rows. Restore: `git clone "$Q/all-refs.bundle" restored-synkroo`; apply selected `tracked.patch`; extract matching archive.
### Task 3: Preserve Root WIP
**Files:** Commit exact six CRM files, two existing docs, and preflight audit.
- [ ] Create backup branch and stage explicit paths:
```bash
git switch -c backup/root-wip-20260723
git add -- src/modules/crm/__tests__/owner-bridge-actions.test.ts src/modules/crm/__tests__/routes.test.ts \
 src/modules/crm/index.ts src/modules/crm/manifest.ts src/modules/crm/repositories/duplicate-suggestions-repository.ts \
 src/modules/crm/ui/route-adapter.ts docs/superpowers/audits/2026-07-22-eixo2-status.md \
 docs/superpowers/plans/2026-07-15-eixo2-security-integrity-hardening-implementation.md \
 docs/superpowers/audits/2026-07-23-pre-consolidation-inventory.md
git diff --cached --name-only
git diff --cached --check
```
Expected: exactly nine paths; no secret/generated file.
- [ ] Commit and record:
```bash
git commit -m "backup: preserve pre-consolidation WIP"
git rev-parse HEAD > /d/projetos/_synkroo-quarantine/2026-07-23/root-wip-commit.txt
git status --short
```
Rollback: restore exact file via `git restore --source=backup/root-wip-20260723 -- "$FILE"`.
### Task 4: Isolated Consolidation Worktree
- [ ] Create worktree and apply WIP uncommitted:
```bash
WT=/d/projetos/_synkroo-consolidation-20260723
git worktree add -b chore/consolidate-main-20260723 "$WT" chore/atendimento-eixo2-implementation
git -C "$WT" cherry-pick -n backup/root-wip-20260723
git -C "$WT" status --short
```
Expected: nine WIP paths. Rollback without force:
```bash
git -C "$WT" restore --source=HEAD --staged --worktree -- .
rm -f "$WT/docs/superpowers/audits/2026-07-22-eixo2-status.md" "$WT/docs/superpowers/audits/2026-07-23-pre-consolidation-inventory.md" "$WT/docs/superpowers/plans/2026-07-15-eixo2-security-integrity-hardening-implementation.md"
git worktree remove "$WT"
```
Backup branch remains immutable.
### Task 5: CRM WIP TDD
**Files:** Modify `src/modules/{operacional,comercial}/index.ts`, CRM tests/WIP; evaluate CRM cron paths.
- [ ] RED:
```bash
cd /d/projetos/_synkroo-consolidation-20260723
npx jest src/modules/crm/__tests__/owner-bridge-actions.test.ts src/modules/crm/__tests__/routes.test.ts --runInBand --coverage=false
```
Expected: 7 failures, 40 passes.
- [ ] Add owner actions to canonical public arrays:
```typescript
// operacional/index.ts imports + operacionalActions
registrarObservacaoPaciente,
atualizarTagsPaciente,
// comercial/index.ts imports + comercialActions
registrarNotaLead,
atualizarTagsLead,
```
Import the four actions from their exact `./actions/registrar-*` and `./actions/atualizar-*` files; do not add side-effect registration to `actions/index.ts`.
- [ ] Replace broken DB mock boundary:
```typescript
const mockUpdateReturning = jest.fn();
const mockDbUpdate = jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning: mockUpdateReturning })) })) }));
const mockInsertReturning = jest.fn();
const mockDbInsert = jest.fn(() => ({ values: jest.fn(() => ({ returning: mockInsertReturning })) }));
const mockDb = { update: mockDbUpdate, insert: mockDbInsert };
```
Configure returning spies per test; assert `mockDbUpdate`/`mockDbInsert` directly.
- [ ] Reject dirty `crmActions` metadata: restore `crmActions = []`; objects lacking `input`/`handler` are invalid. Keep regression:
```typescript
expect(crmActions).toEqual([]);
for (const action of getActions()) {
  expect(typeof action.handler).toBe('function');
  expect(action.input).toBeDefined();
}
```
- [ ] Verify manifest/repository/cron WIP, then full CRM gate:
```bash
npx jest src/modules/crm/__tests__/action-taxonomy.test.ts src/modules/crm/__tests__/crm-duplicates-cron.test.ts src/app/api/cron/crm-duplicates/route.test.ts --runInBand --coverage=false
npx jest src/modules/crm/__tests__ src/app/api/cron/crm-duplicates/route.test.ts --runInBand --coverage=false
```
Keep `jobs:['crm-duplicates']` and distinct clinic query only if these contracts pass. Implement route per-clinic through `buildSystemContext` + `runAction`; continue after per-clinic failure.
- [ ] Commit only focused paths:
```bash
git add src/modules/operacional/index.ts src/modules/comercial/index.ts src/modules/crm src/app/api/cron/crm-duplicates docs/superpowers/audits docs/superpowers/plans
git diff --cached --check
git commit -m "fix: complete protected CRM work"
```
Immediate rollback: `git revert HEAD`; original WIP stays on backup branch.
### Task 6: IA Allowlist TDD
**Files:** Agent bridge tests, `bridge-service.ts`, existing `tool-policy.ts`.
- [ ] Add RED assertions: catalog excludes cancel action; blocked execution returns `unknown_tool`; `runAction` and `markSeen` have zero calls. Run focused tests; expect failures.
- [ ] Implement filtering and ordering:
```typescript
const allowed = deps.getActions().filter((a) => isAgentSafeAction(a.name) && ctx.hasModule(a.module) && ctx.can(a.requires));
// resolve alias; reject !isAgentSafeAction(action.name) before markSeen/runAction
```
Keep `wasSeen` before execution; move `markSeen` after allowlist acceptance.
- [ ] Verify and commit:
```bash
npx jest src/core/agent-bridge/__tests__ --runInBand --coverage=false
git add src/core/agent-bridge && git commit -m "fix: enforce IA bridge allowlist"
```
Rollback: revert this commit; never merge allowlist branch wholesale.
### Task 7: Selective Security/CI TDD
**Files:** CI workflow/test and integration runner/test.
- [ ] Create node:test contract for `push.branches: ['**']`; run and confirm RED while `['*']` remains.
- [ ] Change filter to `['**']`. Before Next build, create DB `synkroo`, enable vector, run `npm run db:migrate`, then `node scripts/seed-test-clinic.mjs` with `DATABASE_URL=postgresql://synkroo:test@127.0.0.1:5432/synkroo`.
- [ ] Add RED runner test: setting parent `TEST_DATABASE_URL` must not expose it in child options.
- [ ] Implement:
```javascript
const { TEST_DATABASE_URL: _ignored, ...inheritedEnv } = process.env;
return { cwd: PROJECT_ROOT, stdio: 'inherit', env: { ...inheritedEnv, DATABASE_URL: testUrl } };
```
- [ ] Verify/selectively commit:
```bash
node --test .github/workflows/__tests__/branch-filter.test.mjs scripts/__tests__/integration-run.test.mjs
git add .github/workflows/ci.yml .github/workflows/__tests__/branch-filter.test.mjs scripts/integration-run.mjs scripts/__tests__/integration-run.test.mjs
git diff --cached --name-only
git commit -m "fix: preserve valid security CI gates"
```
Expected: four paths only. Rollback: revert commit.
### Task 8: Branch Decision Ledger
**Files:** Create `docs/superpowers/audits/2026-07-23-branch-decision-ledger.md`.
- [ ] Capture evidence:
```bash
OUT=docs/superpowers/audits/2026-07-23-branch-decision-ledger.md
: > "$OUT"
for B in main feat/eixo2-task1-allowlist feat/seed-local-scale fix/instagram-webhook-raw-bytes fix/security-integrity-hardening spike/cf-runtime spike/ia-agente-referencia spike/ia-opennext-binding; do
  { echo "## $B"; git cherry HEAD "$B"; git rev-list --left-right --cherry-pick --count HEAD..."$B"; git diff --stat HEAD "$B"; } >> "$OUT"
done
```
- [ ] Append decisions: Instagram/main/21 ancestors redundant; allowlist/security integrated semantically; seed/spikes quarantined; no ref deletion.
- [ ] `git add "$OUT" && git commit -m "docs: record branch consolidation decisions"`.
Rollback: revert documentation commit; no refs changed.
### Task 9: Proven Hygiene Cleanup
**Files:** `.gitignore`, hygiene test; remove proven artifacts/scripts.
- [ ] Create `scripts/__tests__/gitignore-hygiene.test.mjs` asserting ignores for `.tmp*/`, `.playwright-{cli,mcp}/`, `.superpowers/`, `_openNextBuild/`, `preview.pid`, `.open-next/`, `.wrangler/state/`. Run RED, update ignore, run GREEN.
- [ ] Remove tracked pollution:
```bash
git rm -r .open-next .playwright-mcp .superpowers _bmad
git rm .claude/settings.local.json .ec-events preview.pid e2e/TEST_REPORT.md start-agents.bat ux-analysis.md
git rm scripts/debug-minimax.js scripts/test-api-route.js scripts/test-direct.js scripts/test-exact-api.js scripts/test-exact-fn.js scripts/test-minimax-final.js scripts/test-minimax-fixed.js scripts/test-minimax-json.js scripts/test-minimax-standalone.js scripts/test-module.mjs
python - <<'PY'
import subprocess
for p in subprocess.check_output(['git','ls-files','-z']).split(b'\0'):
    if b'Tempmigrate-err.txt' in p: subprocess.run(['git','rm','--',p.decode('utf-8')], check=True)
PY
```
- [ ] Verify/commit:
```bash
node --test scripts/__tests__/gitignore-hygiene.test.mjs
git add .gitignore scripts/__tests__/gitignore-hygiene.test.mjs
git ls-files -ci --exclude-standard
git diff --cached --check
git commit -m "chore: remove generated and obsolete artifacts"
```
Expected: ignored-tracked output is empty. Rollback: revert commit; quarantine retains copies.
### Task 10: Archive legacy planning
**Files:** Create `docs/archive/legacy-planning-v0.3-summary.md`; update refs; remove legacy planning tree.
- [ ] Write factual summary: April–May 2026 phases, obsolete Supabase assumptions, current Drizzle/NextAuth roadmap, source commit `db080da9`.
- [ ] Replace active legacy-planning citations with summary or immutable `archive/planning-v0.3` citation.
- [ ] Tag immutable history, remove legacy planning tree, and commit documentation.
Rollback: revert commit or restore from `archive/planning-v0.3`.
### Task 11: Root Wrangler Types Decision
**Files:** Evaluate/remove root `worker-configuration.d.ts`; retain both worker-specific files.
- [ ] Reproduce and compare:
```bash
mkdir -p .tmp/wrangler-types
npx wrangler types .tmp/wrangler-types/root-worker-configuration.d.ts --config wrangler.toml
git diff --no-index -- worker-configuration.d.ts .tmp/wrangler-types/root-worker-configuration.d.ts || true
git grep -n 'worker-configuration.d.ts' -- ':!docs/**'
```
- [ ] Verify root/worker typechecks:
```bash
npm run typecheck
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
```
- [ ] If root output is reproducible and unused, remove only root file:
```bash
git rm worker-configuration.d.ts
printf '\n# Generated root Wrangler types\n/worker-configuration.d.ts\n' >> .gitignore
git add .gitignore && git commit -m "chore: regenerate root Wrangler types on demand"
```
If reproduction differs semantically, stop and record `KEEP` in branch ledger. Rollback: revert commit; regenerate with first command.
### Task 12: Stale Text and ESLint CLI TDD
**Files:** Admin route/test, package files, `eslint.rules.json`, `eslint.config.mjs`, lint-config test.
- [ ] RED admin test: expect 403 and `{ error:'Migrations are managed by Drizzle CLI; run npm run db:migrate' }`; update route; run focused Jest green.
- [ ] RED lint test: expect script `eslint . --max-warnings=0`, flat config exists, rule data includes `boundaries/dependencies`.
- [ ] Install/migrate:
```bash
npm install -D @eslint/eslintrc@3.3.5 @typescript-eslint/eslint-plugin@8.57.2 @typescript-eslint/parser@8.57.2
git mv .eslintrc.json eslint.rules.json
```
Create `eslint.config.mjs`:
```javascript
import { readFileSync } from 'node:fs';
import { FlatCompat } from '@eslint/eslintrc';
const legacy = JSON.parse(readFileSync(new URL('./eslint.rules.json', import.meta.url), 'utf8'));
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [{ ignores: ['.next/**','.open-next/**','coverage/**','node_modules/**','playwright-report/**','test-results/**'] }, ...compat.config(legacy)];
```
Set package lint script to `eslint . --max-warnings=0`.
- [ ] Verify/commit:
```bash
npx jest src/__tests__/api/admin/run-migration/route.test.ts --runInBand --coverage=false
node --test scripts/__tests__/eslint-config.test.mjs
npm run lint
npm run typecheck
git add src/app/api/admin src/__tests__/api/admin package.json package-lock.json eslint.config.mjs eslint.rules.json scripts/__tests__/eslint-config.test.mjs
git commit -m "chore: align migration guidance and lint CLI"
```
Rollback: revert commit.
### Task 13: Full Quality/Security Gates
**Files:** No source edits unless failure gets its own RED→GREEN commit.
- [ ] Install/static/unit/integration:
```bash
npm ci
npm run lint
npm run typecheck
npm test -- --runInBand
docker compose up -d --wait
TEST_DATABASE_URL=postgresql://synkroo:test@127.0.0.1:5432/synkroo_test npm run test:integration:run
```
- [ ] Build/Workers/mutation:
```bash
npm run build
npm run build:cf
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
npm run test:security:repositories
npm run test:security:services
```
Expected: all exit 0; mutation ≥70%.
- [ ] Secret and hygiene gates:
```bash
docker run --rm -v "$(pwd):/repo" ghcr.io/gitleaks/gitleaks:v8.24.2 detect --source=/repo --no-banner --redact
docker run --rm -v "$(pwd):/repo" ghcr.io/gitleaks/gitleaks:v8.24.2 dir /repo --no-banner --redact
git ls-files -ci --exclude-standard
git status --short --branch
```
Expected: no unresolved secret, no ignored tracked path, clean branch. Timeout is not pass. Rollback: revert only dedicated failing-gate commit; never bypass gate.
### Task 14: Promotion Approval
**Files:** None.
- [ ] Present commits, branch ledger, gates, bundle/hash proof, and quarantine list.
- [ ] Request explicit approval naming: removal of old local-main worktree; local `main` move; root checkout; PR versus authorized protected push.
Expected: explicit approval. Otherwise stop. Rollback: none.
### Task 15: Promote to Local `main`
**Files:** Git refs/worktrees only.
- [ ] Tag all rollback points:
```bash
git tag archive/local-main-20260723 main
git tag archive/candidate-20260723 chore/atendimento-eixo2-implementation
git tag pre-promotion-20260723 chore/consolidate-main-20260723
```
- [ ] Archive old-main generated files, remove exact copies, require clean status, then release without force:
```bash
OLD=D:/projetos/synkroo/.worktrees/eixo2-task0-runner
DEST=/d/projetos/_synkroo-quarantine/2026-07-23/old-main-generated
mkdir -p "$DEST"
for F in .tdd-log.tsv .verification-log reports; do [ ! -e "$OLD/$F" ] || cp -a "$OLD/$F" "$DEST/"; done
rm -f "$OLD/.tdd-log.tsv" "$OLD/.verification-log"
rm -rf "$OLD/reports"
git -C "$OLD" status --short
git worktree remove "$OLD"
```
Expected: status empty before removal.
- [ ] Move local main and normalize root:
```bash
git branch -f main chore/consolidate-main-20260723
git switch main
git merge-base --is-ancestor origin/main main
git status --short --branch
```
Expected: clean root `main`; `origin/main` ancestor. Push consolidation branch + PR by default; direct `git push origin main` only if Task 14 explicitly permits it.
Rollback:
```bash
git switch backup/root-wip-20260723
git branch -f main archive/local-main-20260723
git worktree add D:/projetos/synkroo/.worktrees/eixo2-task0-runner main
```
### Task 16: 30-Day Quarantine Closure
**Files:** Create `docs/superpowers/audits/2026-08-22-approved-removals.tsv` after second approval.
- [ ] On/after 2026-08-22, verify hashes, clean main, worktrees, merged refs:
```bash
(cd /d/projetos/_synkroo-quarantine/2026-07-23 && sha256sum -c SHA256SUMS)
git status --short --branch
git worktree list --porcelain
git branch --merged main
```
- [ ] Request explicit deletion approval; record each approved row as `worktree<TAB>path` or `branch<TAB>name`.
- [ ] Execute only approved clean rows:
```bash
AUDIT=docs/superpowers/audits/2026-08-22-approved-removals.tsv
awk -F '\t' '$1=="worktree"{print $2}' "$AUDIT" | while IFS= read -r P; do git -C "$P" diff --quiet && git -C "$P" diff --cached --quiet && test -z "$(git -C "$P" ls-files --others --exclude-standard)" && git worktree remove "$P"; done
awk -F '\t' '$1=="branch"{print $2}' "$AUDIT" | while IFS= read -r B; do git merge-base --is-ancestor "$B" main && git branch -d "$B"; done
```
Unmerged seed/spikes remain until separately tagged and explicitly approved; never use `git clean`, `reset --hard`, `worktree remove --force`, or implicit bulk deletion.
Rollback: clone `all-refs.bundle`, restore the named ref from `refs.txt`, then recreate its recorded worktree path. Retain bundle/hashes longer when audit policy requires.
---
## Plan Self-review
- Tasks 1–16 cover every spec requirement.
- Destructive work follows verified backup and named approvals.
- CRM uses module public arrays, matching `bootstrapActions()` source.
- Invalid dirty CRM metadata is rejected; valid manifest/cron WIP requires tests.
- Allowlist/security use semantic integration only.
- Every cleanup class has rollback and 30-day retention.
