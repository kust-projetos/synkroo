# CI Seed Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task.

**Goal:** Prepare CI build database, add fail-closed deterministic local seed, archive two reviewed worktrees.

**Architecture:** Node contract test reads workflow. Seed has pure parse/guard/fixture helpers plus a narrow Drizzle adapter. Git archive is separate, sequential and non-force.

**Tech Stack:** Node test runner + `tsx`, TypeScript, Drizzle/PostgreSQL, Git worktrees.

**Agent Orchestration:** Single-Agent Looped.

## Requirements map

| Requirement | Task |
|---|---|
| REQ-1/2 | 2 |
| REQ-3/4/6 | 3 |
| REQ-5/8 | 4 |
| REQ-7 | 6 |

## Task 1: Baseline

**Files:** none.

- [ ] Run `git status --short --branch` in `ci-seed-archive-20260725`; expected clean branch.
- [ ] Run `npm test -- --runInBand`; capture failures; stop if baseline fails.
- [ ] Record `git worktree list --porcelain | grep -c '^worktree '` and six `refs/backup`.

## Task 2: CI contract and build DB

**Files:**
- Create `scripts/__tests__/ci-workflow.test.mjs`
- Modify `.github/workflows/ci.yml`

- [ ] RED — write:

```js
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync('.github/workflows/ci.yml', 'utf8');
const at = (text) => source.indexOf(text);

test('CI prepares synkroo before Next build', () => {
  const ordered = [
    "branches: ['**']",
    'CREATE DATABASE "synkroo"',
    'CREATE EXTENSION IF NOT EXISTS vector',
    'npm run db:migrate',
    'node scripts/seed-test-clinic.mjs',
    'Build (Next.js)',
  ];
  for (const item of ordered) assert.notEqual(at(item), -1, `missing ${item}`);
  for (let index = 1; index < ordered.length; index += 1) {
    assert.ok(at(ordered[index - 1]) < at(ordered[index]), `${ordered[index - 1]} must precede ${ordered[index]}`);
  }
});
```

- [ ] Run `node --test scripts/__tests__/ci-workflow.test.mjs`; expected FAIL: missing `CREATE DATABASE "synkroo"`.
- [ ] GREEN — add before `Build (Next.js)`:

```yaml
      - name: Setup synkroo database for build
        run: |
          psql -h 127.0.0.1 -p 5432 -U synkroo -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'synkroo'" | grep -q 1 || psql -h 127.0.0.1 -p 5432 -U synkroo -d postgres -c "CREATE DATABASE \"synkroo\""
          psql -h 127.0.0.1 -p 5432 -U synkroo -d synkroo -c "CREATE EXTENSION IF NOT EXISTS vector;"
        env:
          PGPASSWORD: test

      - name: Migrate and seed synkroo database for build
        run: |
          npm run db:migrate
          node scripts/seed-test-clinic.mjs
        env:
          DATABASE_URL: postgresql://synkroo:test@127.0.0.1:5432/synkroo
```

- [ ] Run `node --test scripts/__tests__/ci-workflow.test.mjs`; expected PASS.
- [ ] Run `git diff --check`; expected no output.

## Task 3: Pure seed guard and fixture

**Files:**
- Create `scripts/seed-local-scale.ts`
- Create `scripts/__tests__/seed-local-scale.test.ts`
- Create `scripts/seed-local-scale-data.ts`
- Modify `package.json`

- [ ] RED — write Node-test API tests:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFixture, parseOptions, validateScaleDatabaseUrl } from '../seed-local-scale';

test('defaults to non-mutating small preset', () => {
  assert.deepEqual(parseOptions([]), { preset: 'small', seed: 1337, apply: false });
});
test('rejects remote or wrong database', () => {
  assert.throws(() => validateScaleDatabaseUrl('postgres://u:p@db.example/synkroo'), /loopback/);
  assert.throws(() => validateScaleDatabaseUrl('postgres://u:p@localhost/other'), /synkroo/);
});
test('same seed creates same fixture', () => {
  assert.deepEqual(buildFixture({ preset: 'small', seed: 7, apply: false }), buildFixture({ preset: 'small', seed: 7, apply: false }));
});
```

- [ ] Run `node --import tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected FAIL: module missing.
- [ ] GREEN — implement exact pure contract:

```ts
export type SeedOptions = { preset: 'small' | 'large'; seed: number; apply: boolean };
export const PRESETS = { small: { patients: 20, appointments: 40 }, large: { patients: 200, appointments: 400 } } as const;
export function parseOptions(argv: string[]): SeedOptions;
export function validateScaleDatabaseUrl(url: string): string;
export function buildFixture(options: SeedOptions): { clinic: { slug: 'clinica-demo' }; patients: readonly { key: string; name: string; phone: string }[]; appointments: readonly { key: string; patientKey: string; scheduledAt: string }[] };
```

Rules: parser accepts only `--preset small|large`, `--seed <integer>`, `--apply`; rejects duplicate/unknown args. Guard accepts only `postgres:`/`postgresql:`, hostname `localhost`/`127.0.0.1`/`::1`, pathname `/synkroo`. Fixture uses Mulberry32 and stable keys `demo-patient-<n>`/`demo-appointment-<n>`.

- [ ] Add `"db:seed:scale": "tsx scripts/seed-local-scale-data.ts"`.
- [ ] Run `node --import tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected PASS.

## Task 4: Demo-only transaction adapter

**Files:**
- Modify `scripts/seed-local-scale.ts`
- Modify `scripts/seed-local-scale-data.ts`
- Modify `scripts/__tests__/seed-local-scale.test.ts`

- [ ] RED — add tests proving `--apply` is required before adapter invocation, fixture counts are 20/40 and 200/400, and adapter receives only slug `clinica-demo`.
- [ ] Run `node --import tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected FAIL.
- [ ] GREEN — CLI behavior:

```ts
const options = parseOptions(process.argv.slice(2));
const fixture = buildFixture(options);
console.log(JSON.stringify({ preset: options.preset, patients: fixture.patients.length, appointments: fixture.appointments.length, apply: options.apply }));
if (!options.apply) process.exitCode = 0;
else await persistDemoFixture(validateScaleDatabaseUrl(process.env.DATABASE_URL ?? ''), fixture);
```

`persistDemoFixture` opens DB only after guard success; wraps all writes in one transaction; finds/upserts clinic `clinica-demo`; deletes/reinserts only appointments and patients scoped to returned clinic ID; inserts `patients` with `clinicId`, `name`, `phone`; inserts appointments with `clinicId`, `patientId`, `scheduledAt`, `status: 'scheduled'`; uses no `session_replication_role`, `as any`, global delete or network call.

- [ ] Run `node --import tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected PASS.

## Task 5: Quality gates

- [ ] Run `node --test scripts/__tests__/ci-workflow.test.mjs`.
- [ ] Run `node --import tsx --test scripts/__tests__/seed-local-scale.test.ts`.
- [ ] Run `npm run lint && npm run typecheck`.
- [ ] Create `stryker.seed.config.json` targeting `scripts/seed-local-scale.ts`; run `npx stryker run stryker.seed.config.json`; expected mutation score ≥70%.
- [ ] Coverage: run `npx c8 --all --lines 80 --functions 80 --branches 80 node --import tsx --test scripts/__tests__/seed-local-scale.test.ts`.
- [ ] Integration is opt-in: ask user before running `DATABASE_URL=postgresql://synkroo:<password>@localhost:<port>/synkroo npm run db:seed:scale -- --apply`.

## Task 6: Archive approved worktrees

**Files:** none; this produces no source commit.

- [ ] Before each removal, capture current worktree count, validate clean status and preserved branch OID: `feat/eixo2-task1-allowlist`=`162ba69b…`; `spike/ia-agente-referencia`=`c9b51788…`; verify six backup refs.
- [ ] Run sequentially:

```bash
git -C D:/projetos/synkroo worktree remove D:/projetos/synkroo/.worktrees/eixo2-task1-allowlist
git -C D:/projetos/synkroo worktree remove D:/projetos/synkroo/.worktrees/spike-ia-agente-referencia
```

- [ ] Verify each registry/path absent, both branch OIDs preserved, backup refs still six and count is baseline minus two.
- [ ] Never use `--force`, `prune`, `gc`, manual deletion or branch deletion.

## Commit sequence

1. `test: add CI workflow contract`
2. `ci: prepare build database`
3. `test: cover safe scale seed`
4. `feat: add safe local scale seed`

## Self-review

- [ ] REQ-1..REQ-8 mapped above.
- [ ] Every production/configuration change has observed RED then GREEN.
- [ ] No DB mutation runs without explicit integration approval.
- [ ] `git diff --check` clean.
