/**
 * Tests for scripts/repository-mutation-run.mjs — repository mutation test runner.
 *
 * Validates:
 *  - Import is inert (no side effects on load)
 *  - validateTestDatabaseUrl reuses from integration runner (rejects unsafe)
 *  - commandOptions reuses from integration runner
 *  - run calls migrate → seed → Jest (security integration) → Stryker in order
 *  - Each command receives cwd, stdio:'inherit', DATABASE_URL
 *  - Seamless reuse of validateTestDatabaseUrl and commandOptions
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

// ── Helpers ──────────────────────────────────────────────────────────────────

const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..');
const runnerPath = resolve(__dirname, 'repository-mutation-run.mjs');
const runnerHref = pathToFileURL(runnerPath).href;

async function loadRunnerExports() {
  return import(runnerHref);
}

/** Captures execFileSync calls for verification. */
function makeTracker(throwOnStep) {
  const calls = [];
  function fakeExecute(...args) {
    calls.push(args);
    if (throwOnStep && calls.length === throwOnStep) {
      throw new Error(`simulated step ${throwOnStep} failure`);
    }
    return Buffer.from('');
  }
  return { fakeExecute, calls };
}

const TEST_URL = 'postgres://synkroo:change-me@localhost:55432/synkroo_test';
const isWin = process.platform === 'win32';
const comSpec = process.env.ComSpec || 'cmd.exe';
const npmBin = isWin ? comSpec : 'npm';
const npmPrefix = isWin ? ['/d', '/s', '/c', 'npm.cmd'] : [];

// ── Import inertness ─────────────────────────────────────────────────────────

describe('import inertness', () => {
  it('importing the module does not trigger run side effects', async () => {
    const mod = await loadRunnerExports();
    assert.ok(mod.validateTestDatabaseUrl, 'exports validateTestDatabaseUrl');
    assert.ok(mod.commandOptions, 'exports commandOptions');
    assert.ok(mod.run, 'exports run');
  });
});

// ── validateTestDatabaseUrl ──────────────────────────────────────────────────

describe('validateTestDatabaseUrl (reused from integration-run)', () => {
  it('rejects unsafe URL', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.throws(() => validateTestDatabaseUrl(undefined), /TEST_DATABASE_URL.*required/i);
    assert.throws(() => validateTestDatabaseUrl('postgres://u:p@prod.example.com:5432/synkroo_test'),
      /loopback|localhost|127\.0\.0\.1|::1/i);
  });

  it('accepts loopback /synkroo_test', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.equal(validateTestDatabaseUrl(TEST_URL), TEST_URL);
  });
});

// ── commandOptions ───────────────────────────────────────────────────────────

describe('commandOptions (reused from integration-run)', () => {
  it('returns cwd, stdio:inherit, DATABASE_URL', async () => {
    const { commandOptions } = await loadRunnerExports();
    const opts = commandOptions(TEST_URL);
    assert.ok(opts.cwd, 'should have cwd');
    assert.equal(opts.stdio, 'inherit');
    assert.equal(opts.env.DATABASE_URL, TEST_URL);
  });
});

// ── run() — orchestration ────────────────────────────────────────────────────

describe('run — orchestration', () => {
  it('calls migrate → seed → Jest → Stryker in order with correct commands', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(4);

    assert.throws(() => run(fakeExecute, TEST_URL, []), /simulated step 4 failure/);

    assert.equal(calls.length, 4, 'should call execute 4 times');

    // Step 1: npm run db:migrate
    assert.equal(calls[0][0], npmBin, 'step 1 command');
    assert.deepEqual(calls[0][1], [...npmPrefix, 'run', 'db:migrate'], 'step 1 args');

    // Step 2: node scripts/seed-test-clinic.mjs
    assert.equal(calls[1][0], process.execPath, 'step 2 command');
    assert.deepEqual(calls[1][1], ['scripts/seed-test-clinic.mjs'], 'step 2 args');

    // Step 3: npm exec -- jest --config jest.security.integration.config.js --coverage
    assert.equal(calls[2][0], npmBin, 'step 3 command');
    assert.deepEqual(calls[2][1], [...npmPrefix, 'exec', '--', 'jest', '--config', 'jest.security.integration.config.js', '--coverage'], 'step 3 args');

    // Step 4: npm exec -- stryker run stryker.repositories.config.json
    assert.equal(calls[3][0], npmBin, 'step 4 command');
    assert.deepEqual(calls[3][1], [...npmPrefix, 'exec', '--', 'stryker', 'run', 'stryker.repositories.config.json'], 'step 4 args');
  });

  it('each step receives stdio:inherit and DATABASE_URL', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(4);

    assert.throws(() => run(fakeExecute, TEST_URL, []));

    for (let i = 0; i < 4; i++) {
      const opts = calls[i][2];
      assert.equal(opts.stdio, 'inherit', `step ${i + 1} stdio`);
      assert.equal(opts.env.DATABASE_URL, TEST_URL, `step ${i + 1} DATABASE_URL`);
    }
  });

  it('aborts on step 1 (migrate) failure and does not run subsequent steps', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(1);

    assert.throws(() => run(fakeExecute, TEST_URL, []));
    assert.equal(calls.length, 1, 'only step 1 was attempted');
  });

  it('aborts on step 3 (Jest) failure and does not run Stryker', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(3);

    assert.throws(() => run(fakeExecute, TEST_URL, []));
    assert.equal(calls.length, 3, 'steps 1-3 attempted, no stryker');
  });

  it('accepts extra jestArgs forwarded to Jest command', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(4);

    assert.throws(() => run(fakeExecute, TEST_URL, ['--testPathPattern=scope']));

    const baseJestArgs = ['exec', '--', 'jest', '--config', 'jest.security.integration.config.js', '--coverage'];
    const expectedLength = npmPrefix.length + baseJestArgs.length + 1;
    assert.equal(calls[2][1].length, expectedLength, 'jest args count');
    assert.equal(calls[2][1][calls[2][1].length - 1], '--testPathPattern=scope', 'last arg is forwarded jestArg');
  });
});
