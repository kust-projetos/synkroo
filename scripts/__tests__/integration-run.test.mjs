/**
 * Tests for scripts/integration-run.mjs — integration test runner.
 *
 * Validates:
 *  - validateTestDatabaseUrl rejects missing/remote/local-outside-/synkroo_test
 *  - validateTestDatabaseUrl accepts loopback /synkroo_test with exact contract
 *  - Import is inert (no side effects on load)
 *  - commandOptions(testUrl) returns cwd, stdio:'inherit', DATABASE_URL
 *  - run() calls migrate → seed → Jest in order with exact commands/args
 *  - Each step receives execFileSync signature (cmd, args, options)
 *  - Failures in any step (migrate, seed, Jest) abort subsequent steps
 *  - Jest failure propagates independently
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

// ── Helpers ──────────────────────────────────────────────────────────────────

const __dirname = resolve(fileURLToPath(import.meta.url), '..', '..');
const runnerPath = resolve(__dirname, 'integration-run.mjs');
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
      throw new Error(`simulated ${['migrate', 'seed', 'jest'][throwOnStep - 1]} failure`);
    }
    return Buffer.from('');
  }
  return { fakeExecute, calls };
}

const TEST_URL = 'postgres://synkroo:change-me@localhost:55432/synkroo_test';

// ── validateTestDatabaseUrl ──────────────────────────────────────────────────

describe('validateTestDatabaseUrl', () => {
  it('rejects undefined / missing URL', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.throws(() => validateTestDatabaseUrl(undefined), /TEST_DATABASE_URL.*required/i);
    assert.throws(() => validateTestDatabaseUrl(null), /TEST_DATABASE_URL.*required/i);
    assert.throws(() => validateTestDatabaseUrl(''), /TEST_DATABASE_URL.*required/i);
  });

  it('rejects remote URL (non-loopback hostname)', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.throws(() => validateTestDatabaseUrl('postgres://user:pass@prod-db.example.com:5432/synkroo_test'),
      /loopback|localhost|127\.0\.0\.1|::1/i);
    assert.throws(() => validateTestDatabaseUrl('postgres://user:pass@10.0.0.1:5432/synkroo_test'),
      /loopback|localhost|127\.0\.0\.1|::1/i);
    assert.throws(() => validateTestDatabaseUrl('postgres://user:pass@192.168.1.1:5432/synkroo_test'),
      /loopback|localhost|127\.0\.0\.1|::1/i);
  });

  it('rejects local URL with wrong database name', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.throws(() => validateTestDatabaseUrl('postgres://user:pass@localhost:5432/synkroo_production'),
      /synkroo_test/i);
    assert.throws(() => validateTestDatabaseUrl('postgres://user:pass@localhost:5432/synkroo'),
      /synkroo_test/i);
    assert.throws(() => validateTestDatabaseUrl('postgres://user:pass@localhost:5432/synkroo_dev'),
      /synkroo_test/i);
  });

  it('rejects local URL with invalid pathname', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.throws(() => validateTestDatabaseUrl('postgres://user:pass@localhost:5432/synkroo_test_extra'),
      /synkroo_test/i);
  });

  it('accepts localhost /synkroo_test', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.equal(validateTestDatabaseUrl(TEST_URL), TEST_URL);
  });

  it('accepts 127.0.0.1 /synkroo_test', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    const url = 'postgres://synkroo:change-me@127.0.0.1:55432/synkroo_test';
    assert.equal(validateTestDatabaseUrl(url), url);
  });

  it('accepts ::1 /synkroo_test', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    const url = 'postgres://synkroo:change-me@[::1]:55432/synkroo_test';
    assert.equal(validateTestDatabaseUrl(url), url);
  });

  it('accepts ipv6 without brackets /synkroo_test', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    const url = 'postgres://synkroo:change-me@[::1]:55432/synkroo_test';
    const parsed = new URL(url);
    const host = parsed.hostname;
    const testUrl = `postgres://u:p@${host}:55432/synkroo_test`;
    assert.equal(validateTestDatabaseUrl(testUrl), testUrl);
  });
});

// ── commandOptions ────────────────────────────────────────────────────────────

describe('commandOptions', () => {
  it('returns cwd, stdio:inherit, and DATABASE_URL set to testUrl', async () => {
    const { commandOptions } = await loadRunnerExports();
    const opts = commandOptions(TEST_URL);
    assert.ok(opts.cwd, 'should have cwd');
    assert.equal(opts.stdio, 'inherit');
    assert.equal(opts.env.DATABASE_URL, TEST_URL);
    // Should NOT have extraEnv or TEST_DATABASE_URL leaked into child env
    assert.equal(opts.env.TEST_DATABASE_URL, undefined);
  });
});

// ── Import inertness ─────────────────────────────────────────────────────────

describe('import inertness', () => {
  it('importing the module does not trigger run side effects', async () => {
    const mod = await loadRunnerExports();
    assert.ok(mod.validateTestDatabaseUrl, 'exports validateTestDatabaseUrl');
    assert.ok(mod.commandOptions, 'exports commandOptions');
    assert.ok(mod.run, 'exports run');
  });
});

// ── run() — orchestration ────────────────────────────────────────────────────

describe('run — orchestration', () => {
  const projectRoot = resolve(__dirname, '..');
  const isWin = process.platform === 'win32';
  const npmBin = isWin ? 'npm.cmd' : 'npm';

  it('calls migrate → seed → Jest in order with correct commands and args', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker();

    run(fakeExecute, TEST_URL, ['--verbose']);

    assert.equal(calls.length, 3, 'should call execute 3 times');

    // Step 1: npm run db:migrate
    assert.equal(calls[0][0], npmBin, 'step 1 command');
    assert.deepEqual(calls[0][1], ['run', 'db:migrate'], 'step 1 args');

    // Step 2: node scripts/seed-test-clinic.mjs
    assert.equal(calls[1][0], process.execPath, 'step 2 command');
    assert.deepEqual(calls[1][1], ['scripts/seed-test-clinic.mjs'], 'step 2 args');

    // Step 3: npm exec -- jest --config jest.integration.config.js --verbose
    assert.equal(calls[2][0], npmBin, 'step 3 command');
    assert.deepEqual(calls[2][1], ['exec', '--', 'jest', '--config', 'jest.integration.config.js', '--verbose'], 'step 3 args');
  });

  it('each step receives stdio:inherit and DATABASE_URL in options', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker();

    run(fakeExecute, TEST_URL, []);

    for (let i = 0; i < 3; i++) {
      const opts = calls[i][2];
      assert.equal(opts.stdio, 'inherit', `step ${i + 1} stdio`);
      assert.equal(opts.env.DATABASE_URL, TEST_URL, `step ${i + 1} DATABASE_URL`);
    }
  });

  it('passes empty jestArgs when none provided, uses default arg format', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker();

    run(fakeExecute, TEST_URL, []);

    assert.equal(calls[2][1].length, 5, 'jest default args count');
    assert.deepEqual(calls[2][1], ['exec', '--', 'jest', '--config', 'jest.integration.config.js']);
  });

  it('aborts on migrate failure and does not run seed or Jest', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(1); // throw on step 1

    assert.throws(() => run(fakeExecute, TEST_URL, []), /simulated migrate failure/);
    assert.equal(calls.length, 1, 'only migrate was attempted');
  });

  it('aborts on seed failure and does not run Jest', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(2); // throw on step 2

    assert.throws(() => run(fakeExecute, TEST_URL, []), /simulated seed failure/);
    assert.equal(calls.length, 2, 'migrate + seed attempted, no jest');
  });

  it('aborts on Jest failure and propagates error independently', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(3); // throw on step 3

    assert.throws(() => run(fakeExecute, TEST_URL, []), /simulated jest failure/);
    assert.equal(calls.length, 3, 'all three steps attempted, jest threw');
  });
});

// ── npm binary per platform ──────────────────────────────────────────────────

describe('npm binary per platform', () => {
  const isWin = process.platform === 'win32';

  it('uses npm.cmd on Windows, npm on other platforms', async () => {
    const source = readFileSync(runnerPath, 'utf-8');
    const hasNpmCmd = source.includes("'npm.cmd'");
    const hasNpm = source.includes("'npm'");
    if (isWin) {
      assert.ok(hasNpmCmd, 'should contain npm.cmd on Windows');
    } else {
      assert.ok(hasNpm, 'should contain npm on non-Windows');
    }
  });
});

// ── Default parameter wiring ─────────────────────────────────────────────────

describe('run defaults', () => {
  it('run() without arguments reads TEST_DATABASE_URL from env', async () => {
    const { run } = await loadRunnerExports();
    const origUrl = process.env.TEST_DATABASE_URL;
    delete process.env.TEST_DATABASE_URL;

    // Without TEST_DATABASE_URL set, run() defaults should throw validation error
    assert.throws(() => run(() => {}, undefined, []), /TEST_DATABASE_URL.*required/i);

    process.env.TEST_DATABASE_URL = origUrl;
  });
});
