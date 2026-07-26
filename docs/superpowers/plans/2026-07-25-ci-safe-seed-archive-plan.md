# CI Seed Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. Steps use checkbox tracking.

**Goal:** Corrigir banco do build CI, criar seed local fail-closed e arquivar dois worktrees aprovados.

**Architecture:** Contrato Node valida workflow por texto estrutural. Seed separa parser/guard/fábrica determinística/persistência transacional. Arquivamento usa somente `git worktree remove` após preflight.

**Tech Stack:** Node ESM, TypeScript/tsx, Drizzle/PostgreSQL, Jest, Git worktrees.

**Agent Orchestration:** Single-Agent Looped.

## Boundaries

- `scripts/seed-local-scale-data.ts`: CLI fina; nenhuma URL insegura passa ao DB.
- `scripts/seed-local-scale.ts`: parser, guard e geração pura testável.
- `scripts/__tests__/`: contratos de CI e seed.
- `.github/workflows/ci.yml`: só pipeline CI.
- Arquivamento não apaga branch/ref/backup.

## Task 1: Baseline

**Files:** none.

- [ ] Run: `git status --short --branch`; expected: branch `chore/ci-seed-archive-20260725` clean.
- [ ] Run: `npm test -- --runInBand`; expected: capture baseline before edits. If failure, stop and report.
- [ ] Run: `git worktree list --porcelain | grep -c '^worktree '`; record count and six `refs/backup`.

## Task 2: CI workflow contract

**Files:**
- Create: `scripts/__tests__/ci-workflow.test.mjs`
- Modify: `.github/workflows/ci.yml`

- [ ] RED — create test asserting source contains ordered setup before `Build (Next.js)`:

```js
import { readFileSync } from 'node:fs';
import { test, strict as assert } from 'node:test';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
const position = (text) => workflow.indexOf(text);

test('CI prepares synkroo before Next build', () => {
  for (const text of [
    "branches: ['**']",
    'CREATE DATABASE "synkroo"',
    'CREATE EXTENSION IF NOT EXISTS vector',
    'npm run db:migrate',
    'node scripts/seed-test-clinic.mjs',
    'Build (Next.js)',
  ]) assert.ok(position(text) >= 0, `missing ${text}`);
  assert.ok(position('CREATE DATABASE "synkroo"') < position('Build (Next.js)'));
  assert.ok(position('npm run db:migrate') < position('Build (Next.js)'));
  assert.ok(position('node scripts/seed-test-clinic.mjs') < position('Build (Next.js)'));
});
```

- [ ] Run: `node --test scripts/__tests__/ci-workflow.test.mjs`; expected: FAIL because setup steps are absent.
- [ ] GREEN — add idempotent CI steps after integration tests and before build:

```yaml
      - name: Setup synkroo database for build
        run: |
          psql -h 127.0.0.1 -p 5432 -U synkroo -d postgres -c "SELECT 'CREATE DATABASE synkroo' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'synkroo')\gexec"
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

- [ ] Run: `node --test scripts/__tests__/ci-workflow.test.mjs`; expected: PASS.
- [ ] REFACTOR: keep existing `branches: ['**']`; no duplicate branch-filter implementation.

## Task 3: Seed parser and URL guard

**Files:**
- Create: `scripts/seed-local-scale.ts`
- Create: `scripts/__tests__/seed-local-scale.test.ts`
- Create: `scripts/seed-local-scale-data.ts`
- Modify: `package.json`

- [ ] RED — write unit tests for `parseOptions` and `validateScaleDatabaseUrl`:

```ts
expect(parseOptions([])).toEqual({ preset: 'small', seed: 1337, apply: false });
expect(parseOptions(['--preset', 'large', '--apply', '--seed', '7']))
  .toEqual({ preset: 'large', seed: 7, apply: true });
expect(() => validateScaleDatabaseUrl('postgres://x@db.example/synkroo')).toThrow(/loopback/i);
expect(() => validateScaleDatabaseUrl('postgres://x@localhost/other')).toThrow(/synkroo/i);
```

- [ ] Run: `npx tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected: FAIL because module does not exist.
- [ ] GREEN — implement pure exports:

```ts
export type ScaleOptions = { preset: 'small' | 'large'; seed: number; apply: boolean };
export function parseOptions(argv: string[]): ScaleOptions { /* reject unknown/invalid args */ }
export function validateScaleDatabaseUrl(value: string): string { /* postgres + loopback + /synkroo */ }
export function createMulberry32(seed: number): () => number { /* deterministic PRNG */ }
```

- [ ] Add package script: `"db:seed:scale": "tsx scripts/seed-local-scale-data.ts"`.
- [ ] Run: `npx tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected: PASS.

## Task 4: Deterministic demo-only persistence

**Files:**
- Modify: `scripts/seed-local-scale.ts`
- Modify: `scripts/seed-local-scale-data.ts`
- Modify: `scripts/__tests__/seed-local-scale.test.ts`

- [ ] RED — add tests proving same seed yields same 20/40 (`small`) or 200/400 (`large`) records, dry-run never calls persistence, and apply sends only `clinica-demo` fixture.
- [ ] Run: `npx tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected: FAIL.
- [ ] GREEN — implement `buildScaleFixture(options)` and injected `persistScaleFixture`:

```ts
export const PRESETS = { small: { patients: 20, appointments: 40 }, large: { patients: 200, appointments: 400 } } as const;
export async function persistScaleFixture(db, fixture) {
  return db.transaction(async (tx) => {
    // find/upsert only slug `clinica-demo`; delete/reinsert only rows scoped to its ID
  });
}
```

- [ ] CLI flow: parse → validate URL → build fixture → print summary; return before DB access unless `--apply`; apply opens DB and persists.
- [ ] Forbidden: `session_replication_role`, `as any`, global deletes, remote URL, default write.
- [ ] Run: `npx tsx --test scripts/__tests__/seed-local-scale.test.ts`; expected: PASS.

## Task 5: Verification

- [ ] Run: `node --test scripts/__tests__/ci-workflow.test.mjs`.
- [ ] Run: `npx tsx --test scripts/__tests__/seed-local-scale.test.ts`.
- [ ] Run: `npm run lint && npm run typecheck`.
- [ ] Run mutation target for pure seed helper; expected mutation score ≥70%.
- [ ] Integration decision: do not run DB mutation by default; request explicit permission for local PostgreSQL integration after unit/contract tests pass.

## Task 6: Archive approved worktrees

**Files:** none.

- [ ] Preflight each path: registered, clean, expected OID (`162ba69b…`, `c9b51788…`), branch exists, six backup refs.
- [ ] Run sequentially:

```bash
git -C D:/projetos/synkroo worktree remove D:/projetos/synkroo/.worktrees/eixo2-task1-allowlist
git -C D:/projetos/synkroo worktree remove D:/projetos/synkroo/.worktrees/spike-ia-agente-referencia
```

- [ ] Verify each path/registration absent, branch/OID preserved, backup refs remain six, and worktree count decreased exactly two.
- [ ] Never use `--force`, `prune`, `gc`, manual deletion or branch deletion.

## Commit sequence

1. `test: add CI workflow contract`
2. `ci: prepare build database`
3. `test: cover safe scale seed`
4. `feat: add safe local scale seed`
5. `chore: archive reviewed worktrees`

## Self-review

- [ ] Requirements REQ-1..REQ-8 mapped to tasks.
- [ ] RED precedes every production/configuration change.
- [ ] No production database mutation without explicit integration approval.
- [ ] `git diff --check` clean.
