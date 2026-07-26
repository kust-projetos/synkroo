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

Create Jest tests: default options; duplicate `--preset`/`--seed`/`--apply`, missing values and unknown flags throw; remote/wrong URL throws; same seed deep-equals; unique phones; `small` yields 20/40; `large` yields 200/400.

- [ ] Run `npx jest --config jest.seed.config.js`; expected FAIL: module missing.
- [ ] GREEN — implement complete pure helpers:

```ts
export type SeedOptions = { preset: 'small' | 'large'; seed: number; apply: boolean };
export const PRESETS = { small: { patients: 20, appointments: 40 }, large: { patients: 200, appointments: 400 } } as const;
export function parseOptions(argv: string[]): SeedOptions {
  let preset: SeedOptions['preset'] = 'small'; let seed = 1337; let apply = false;
  const seen = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (seen.has(value)) throw new Error(`Duplicate scale-seed argument: ${value}`);
    if (value === '--apply') { seen.add(value); apply = true; continue; }
    if (value === '--preset' && (argv[index + 1] === 'small' || argv[index + 1] === 'large')) { seen.add(value); preset = argv[++index] as SeedOptions['preset']; continue; }
    if (value === '--seed' && /^-?\d+$/.test(argv[index + 1] ?? '')) { seen.add(value); seed = Number(argv[++index]); continue; }
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

Add complete deterministic fixture helpers:

```ts
import { createHash } from 'node:crypto';
export type PatientFixture = { key: string; id: string; name: string; phone: string };
export type AppointmentFixture = { key: string; id: string; patientId: string; scheduledAt: string };
export function stableUuid(key: string): string {
  const hex = createHash('sha256').update(`synkroo-scale:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function buildFixture(options: SeedOptions) {
  const { patients: patientCount, appointments: appointmentCount } = PRESETS[options.preset];
  const patients = Array.from({ length: patientCount }, (_, index) => {
    const key = `demo-patient-${index + 1}`;
    return { key, id: stableUuid(key), name: `Demo Patient ${index + 1}`, phone: `11${String(Math.abs(options.seed) % 10_000).padStart(4, '0')}${String(index + 1).padStart(5, '0')}` };
  });
  const appointments = Array.from({ length: appointmentCount }, (_, index) => {
    const key = `demo-appointment-${index + 1}`;
    return { key, id: stableUuid(key), patientId: patients[index % patients.length].id, scheduledAt: new Date(Date.UTC(2025, 0, 1, 8 + (index % 8), 0, 0)).toISOString() };
  });
  return { clinic: { slug: 'clinica-demo' as const }, patients, appointments };
}
```

- [ ] Add `"db:seed:scale": "tsx scripts/seed-local-scale-data.ts"`; run `npx jest --config jest.seed.config.js`; expected PASS.

## Task 4: Demo-only transaction adapter

**Files:**
- Modify `scripts/seed-local-scale.ts`
- Modify `scripts/seed-local-scale-data.ts`
- Modify `scripts/__tests__/seed-local-scale.test.ts`

- [ ] RED — add complete Jest cases: `--apply --apply`, duplicate `--preset`, missing preset value and unknown args throw; remote/wrong URL throws; same seed deep-equals; small/large are 20/40 and 200/400; dry-run calls `print` but never `persist`; apply calls `persist` once; every appointment `patientId` belongs to fixture patients; adapter calls one transaction, receives only `clinica-demo`, and stale IDs from large→small are the deterministic IDs `demo-patient-21..200`/their appointments only.
- [ ] Run `npx jest --config jest.seed.config.js`; expected FAIL after adding adapter expectations.
- [ ] GREEN — expose CLI and adapter:

```ts
export type SeedStore = { transaction<T>(fn: (tx: SeedStore) => Promise<T>): Promise<T>; resolveClinicId(slug: 'clinica-demo'): Promise<string>; deleteAppointments(ids: string[], clinicId: string): Promise<void>; deletePatients(ids: string[], clinicId: string): Promise<void>; upsertPatients(rows: (PatientFixture & { clinicId: string })[]): Promise<void>; upsertAppointments(rows: (AppointmentFixture & { clinicId: string; status: 'scheduled' })[]): Promise<void> };
export function allSeedIds() { return buildFixture({ preset: 'large', seed: 1337, apply: true }); }
export async function persistFixture(store: SeedStore, fixture: ReturnType<typeof buildFixture>) {
  return store.transaction(async (tx) => {
    const clinicId = await tx.resolveClinicId('clinica-demo');
    const full = allSeedIds();
    const activePatientIds = new Set(fixture.patients.map((patient) => patient.id));
    const activeAppointmentIds = new Set(fixture.appointments.map((appointment) => appointment.id));
    await tx.deleteAppointments(full.appointments.filter((row) => !activeAppointmentIds.has(row.id)).map((row) => row.id), clinicId);
    await tx.deletePatients(full.patients.filter((row) => !activePatientIds.has(row.id)).map((row) => row.id), clinicId);
    await tx.upsertPatients(fixture.patients.map((patient) => ({ ...patient, clinicId })));
    await tx.upsertAppointments(fixture.appointments.map((appointment) => ({ ...appointment, clinicId, status: 'scheduled' })));
  });
}
export async function runCli(deps: { persist: (url: string, fixture: ReturnType<typeof buildFixture>) => Promise<void>; print: (text: string) => void }, argv: string[], env: NodeJS.ProcessEnv) {
  const options = parseOptions(argv); const fixture = buildFixture(options);
  deps.print(JSON.stringify({ preset: options.preset, patients: fixture.patients.length, appointments: fixture.appointments.length, apply: options.apply }));
  if (options.apply) await deps.persist(validateScaleDatabaseUrl(env.DATABASE_URL ?? ''), fixture);
}
```

`seed-local-scale-data.ts` imports `fileURLToPath` and runs only when `process.argv[1] === fileURLToPath(import.meta.url)`. Its Drizzle adapter upserts/finds clinic by `slug` and returns actual clinic ID; implements deletes with `and(eq(table.clinicId, clinicId), inArray(table.id, ids))`; then explicit deterministic-ID upserts. Generated phones encode index and seed to guarantee uniqueness. It builds appointments from fixture `patientId`; no lookup crosses clinics. Therefore repeated seed is idempotent, large→small removes only deterministic demo IDs, and unrelated clinic rows are untouched.

- [ ] Run `npx jest --config jest.seed.config.js`; expected PASS.

## Task 5: Quality gates

- [ ] Run `node --test scripts/__tests__/ci-workflow.test.mjs`.
- [ ] Run `npx jest --config jest.seed.config.js --coverage`.
- [ ] Run `npm run lint && npm run typecheck`.
- [ ] Create `stryker.seed.config.json`:

```json
{"$schema":"./node_modules/@stryker-mutator/core/schema/stryker-schema.json","mutate":["scripts/seed-local-scale.ts"],"testRunner":"jest","jest":{"configFile":"jest.seed.config.js"},"coverageAnalysis":"perTest","reporters":["clear-text","progress"]}
```

- [ ] Run `npx jest --config jest.seed.config.js --listTests`; expected exactly `scripts/__tests__/seed-local-scale.test.ts`.
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
