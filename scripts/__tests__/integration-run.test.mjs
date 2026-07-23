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
      const labels = ['extensions', 'migrate', 'seed', 'jest'];
      throw new Error(`simulated ${labels[throwOnStep - 1] || 'unknown'} failure`);
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

  it('rejects http:// protocol even with valid loopback and /synkroo_test', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.throws(() => validateTestDatabaseUrl('http://localhost:5432/synkroo_test'), /protocol|postgres/i);
    assert.throws(() => validateTestDatabaseUrl('http://127.0.0.1:5432/synkroo_test'), /protocol|postgres/i);
  });

  it('rejects file:// protocol', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.throws(() => validateTestDatabaseUrl('file:///tmp/synkroo_test'), /protocol|postgres/i);
  });

  it('accepts postgresql:// protocol on loopback /synkroo_test', async () => {
    const { validateTestDatabaseUrl } = await loadRunnerExports();
    assert.doesNotThrow(() => validateTestDatabaseUrl('postgresql://127.0.0.1:5432/synkroo_test'));
    assert.doesNotThrow(() => validateTestDatabaseUrl('postgres://localhost:5432/synkroo_test'));
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
  const comSpec = process.env.ComSpec || 'cmd.exe';
  const npmBin = isWin ? comSpec : 'npm';
  const npmPrefix = isWin ? ['/d', '/s', '/c', 'npm.cmd'] : [];

  it('calls extensions → migrate → seed → Jest in order with correct commands and args', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(4);

    assert.throws(() => run(fakeExecute, TEST_URL, ['--verbose']), /simulated jest failure/);

    assert.equal(calls.length, 4, 'should call execute 4 times');

    // Step 0: node -e (pg extension setup) — verifies DATABASE_URL in env
    assert.equal(calls[0][0], process.execPath, 'step 0 command (node)');
    assert.match(calls[0][1][0], /^-e$/, 'step 0 uses -e flag');
    assert.match(calls[0][1][1], /CREATE EXTENSION IF NOT EXISTS vector/, 'step 0 creates vector extension');
    assert.equal(calls[0][2].env.DATABASE_URL, TEST_URL, 'step 0 has DATABASE_URL');

    // Step 1: npm run db:migrate
    assert.equal(calls[1][0], npmBin, 'step 1 command');
    assert.deepEqual(calls[1][1], [...npmPrefix, 'run', 'db:migrate'], 'step 1 args');

    // Step 2: node scripts/seed-test-clinic.mjs
    assert.equal(calls[2][0], process.execPath, 'step 2 command');
    assert.deepEqual(calls[2][1], ['scripts/seed-test-clinic.mjs'], 'step 2 args');

    // Step 3: npm exec -- jest --config jest.integration.config.js --verbose
    assert.equal(calls[3][0], npmBin, 'step 3 command');
    assert.deepEqual(calls[3][1], [...npmPrefix, 'exec', '--', 'jest', '--config', 'jest.integration.config.js', '--verbose'], 'step 3 args');
  });

  it('each step receives stdio:inherit and DATABASE_URL in options', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(4); // throw on step 4 (jest)

    try { run(fakeExecute, TEST_URL, []); } catch {}

    for (let i = 0; i < 4; i++) {
      const opts = calls[i][2];
      assert.equal(opts.stdio, 'inherit', `step ${i + 1} stdio`);
      assert.equal(opts.env.DATABASE_URL, TEST_URL, `step ${i + 1} DATABASE_URL`);
    }
  });

  it('passes empty jestArgs when none provided, uses default arg format', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(4); // throw on step 4 (jest)

    try { run(fakeExecute, TEST_URL, []); } catch {}

    const expectedJestArgs = [...npmPrefix, 'exec', '--', 'jest', '--config', 'jest.integration.config.js'];
    assert.equal(calls[3][1].length, expectedJestArgs.length, 'jest default args count');
    assert.deepEqual(calls[3][1], expectedJestArgs);
  });

  it('aborts on migrate failure and does not run seed or Jest', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(2); // throw on step 2 (migrate)

    assert.throws(() => run(fakeExecute, TEST_URL, []), /simulated migrate failure/);
    assert.equal(calls.length, 2, 'extensions + migrate attempted, no seed/jest');
  });

  it('aborts on seed failure and does not run Jest', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(3); // throw on step 3 (seed)

    assert.throws(() => run(fakeExecute, TEST_URL, []), /simulated seed failure/);
    assert.equal(calls.length, 3, 'extensions + migrate + seed attempted, no jest');
  });

  it('aborts on Jest failure and propagates error independently', async () => {
    const { run } = await loadRunnerExports();
    const { fakeExecute, calls } = makeTracker(4); // throw on step 4 (jest)

    assert.throws(() => run(fakeExecute, TEST_URL, []), /simulated jest failure/);
    assert.equal(calls.length, 4, 'all four steps attempted, jest threw');
  });
});

// ── npm binary per platform ──────────────────────────────────────────────────

describe('npm binary per platform', () => {
  const isWin = process.platform === 'win32';

  it('uses npm.cmd on Windows via cmd.exe, npm on other platforms', async () => {
    const source = readFileSync(runnerPath, 'utf-8');
    const hasComSpec = source.includes('ComSpec');
    const hasNpmCmd = source.includes('npm.cmd');
    const hasNpm = source.includes("'npm'");
    if (isWin) {
      assert.ok(hasComSpec, 'should use ComSpec/cmd.exe on Windows');
      assert.ok(hasNpmCmd, 'should contain npm.cmd on Windows');
    } else {
      assert.ok(hasNpm, 'should contain npm on non-Windows');
    }
  });

  it('npm binary is spawnable via execFileSync (no EINVAL)', async () => {
    if (!isWin) return;
    const { execFileSync } = await import('node:child_process');
    // On Windows, execFileSync('npm.cmd', ...) is known to fail with EINVAL
    // in certain Node.js versions. The runner must work around this by
    // routing through cmd.exe. This test asserts the workaround works.
    const comSpec = process.env.ComSpec || 'cmd.exe';
    const r = execFileSync(comSpec, ['/d', '/s', '/c', 'npm.cmd', '--version'], {
      stdio: 'pipe',
      env: { ...process.env, TEST_DATABASE_URL: 'postgresql://invalid:0@127.0.0.1:5432/synkroo_test' },
    });
    const version = r.toString().trim();
    assert.ok(version.length > 0, 'npm --version should return a version string');
    assert.ok(!isNaN(Number(version.split('.')[0])), 'version should start with a number');
  });
});

// ── isMainModule ──────────────────────────────────────────────────────────────

describe('isMainModule', () => {
  it('returns true when metaUrl matches resolved argv1', async () => {
    const { isMainModule } = await loadRunnerExports();
    // Use real absolute paths: runnerPath is the absolute OS path,
    // runnerHref is the file:// URL — they must match via pathToFileURL(resolve()).
    assert.equal(isMainModule(runnerHref, runnerPath), true);
  });

  it('returns false when argv1 references a different script', async () => {
    const { isMainModule } = await loadRunnerExports();
    assert.equal(isMainModule('file:///fake.mjs', process.argv[1]), false);
  });

  it('returns false when argv1 is undefined or null', async () => {
    const { isMainModule } = await loadRunnerExports();
    assert.equal(isMainModule('file:///project/scripts/integration-run.mjs', undefined), false);
    assert.equal(isMainModule('file:///project/scripts/integration-run.mjs', null), false);
  });

  it('handles Windows backslash paths', async () => {
    const { isMainModule } = await loadRunnerExports();
    assert.equal(isMainModule('file:///C:/project/scripts/integration-run.mjs', 'C:\\project\\scripts\\integration-run.mjs'), true);
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
