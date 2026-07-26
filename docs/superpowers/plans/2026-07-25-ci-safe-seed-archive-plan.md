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
          psql -h 127.0.0.1 -p 5432 -U synkroo -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'synkroo'" | grep -q 1 || psql -h 127.0.0.1 -p 5432 -U synkroo -d postgres -c 'CREATE DATABASE "synkroo"'
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
- Create `scripts/seed-local-scale-data.ts`
- Create `scripts/__tests__/seed-local-scale.test.ts`
- Create `jest.seed.config.js`
- Create `stryker.seed.config.json`
- Modify `package.json`

- [ ] RED — create `jest.seed.config.js`:

```js
module.exports = {
  preset: 'ts-jest', testEnvironment: 'node', roots: ['<rootDir>/scripts'],
  testMatch: ['**/__tests__/seed-local-scale.test.ts'],
  collectCoverageFrom: ['scripts/seed-local-scale.ts'],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
};
```

Create tests using Jest globals: `expect(parseOptions([])).toEqual({ preset: 'small', seed: 1337, apply: false })`; remote/wrong URL throws; same seed yields deep-equal fixtures; `small` yields 20/40 and `large` yields 200/400.

- [ ] Run `npx jest --config jest.seed.config.js`; expected FAIL: module missing.
- [ ] GREEN — implement complete pure helpers:

```ts
export type SeedOptions = { preset: 'small' | 'large'; seed: number; apply: boolean };
export const PRESETS = { small: { patients: 20, appointments: 40 }, large: { patients: 200, appointments: 400 } } as const;
export function parseOptions(argv: string[]): SeedOptions {
  let preset: SeedOptions['preset'] = 'small'; let seed = 1337; let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply' && !apply) { apply = true; continue; }
    if (value === '--preset' && (argv[index + 1] === 'small' || argv[index + 1] === 'large')) { preset = argv[++index] as SeedOptions['preset']; continue; }
    if (value === '--seed' && /^-?\d+$/.test(argv[index + 1] ?? '')) { seed = Number(argv[++index]); continue; }
    throw new Error(`Invalid scale-seed argument: ${value}`);
  }
  return { preset, seed, apply };
}
export function validateScaleDatabaseUrl(url: string): string {
  const parsed = new URL(url); const hosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !hosts.has(parsed.hostname) || parsed.pathname !== '/synkroo') throw new Error('Scale seed requires loopback PostgreSQL database synkroo');
  return url;
}
export function createMulberry32(seed: number): () => number { let value = seed >>> 0; return () => { value += 0x6d2b79f5; let next = value; next = Math.imul(next ^ (next >>> 15), next | 1); next ^= next + Math.imul(next ^ (next >>> 7), next | 61); return ((next ^ (next >>> 14)) >>> 0) / 4294967296; }; }
```

`buildFixture` must call this PRNG once per generated field and produce stable `demo-patient-<n>` and `demo-appointment-<n>` keys.

- [ ] Add `"db:seed:scale": "tsx scripts/seed-local-scale-data.ts"`; run `npx jest --config jest.seed.config.js`; expected PASS.

## Task 4: Demo-only transaction adapter

**Files:**
- Modify `scripts/seed-local-scale.ts`
- Modify `scripts/seed-local-scale-data.ts`
- Modify `scripts/__tests__/seed-local-scale.test.ts`

- [ ] RED — add tests proving `--apply` is required before adapter invocation, fixture counts are 20/40 and 200/400, and adapter receives only slug `clinica-demo`.
- [ ] Run `npx jest --config jest.seed.config.js`; expected FAIL after adding adapter expectations.
- [ ] GREEN — expose `runCli(deps, argv, env)` and main guard:

```ts
export async function runCli(deps: { persist: (url: string, fixture: ReturnType<typeof buildFixture>) => Promise<void>; print: (text: string) => void }, argv: string[], env: NodeJS.ProcessEnv) {
  const options = parseOptions(argv); const fixture = buildFixture(options);
  deps.print(JSON.stringify({ preset: options.preset, patients: fixture.patients.length, appointments: fixture.appointments.length, apply: options.apply }));
  if (!options.apply) return;
  await deps.persist(validateScaleDatabaseUrl(env.DATABASE_URL ?? ''), fixture);
}
if (require.main === module) void runCli({ persist: persistDemoFixture, print: console.log }, process.argv.slice(2), process.env);
```

`persistDemoFixture` validates URL before `getDb`; uses one transaction; upserts clinic `clinica-demo`; uses deterministic UUID v5-equivalent constants derived from fixture keys; upserts patients by those IDs; resolves patient-key→UUID map; upserts appointments with mapped `patientId`, `clinicId`, `scheduledAt`, `status: 'scheduled'`. It never deletes global rows, uses `session_replication_role` or `as any`.

- [ ] Run `npx jest --config jest.seed.config.js`; expected PASS.

## Task 5: Quality gates

- [ ] Run `node --test scripts/__tests__/ci-workflow.test.mjs`.
- [ ] Run `npx jest --config jest.seed.config.js --coverage`.
- [ ] Run `npm run lint && npm run typecheck`.
- [ ] Create `stryker.seed.config.json`:

```json
{"$schema":"./node_modules/@stryker-mutator/core/schema/stryker-schema.json","mutate":["scripts/seed-local-scale.ts"],"testRunner":"jest","jest":{"configFile":"jest.seed.config.js"},"coverageAnalysis":"perTest","reporters":["clear-text","progress"]}
```

- [ ] Run `npx stryker run stryker.seed.config.json`; expected mutation score ≥70%.
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
