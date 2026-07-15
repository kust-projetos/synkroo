/**
 * scripts/integration-run.mjs — Safe, isolated integration test runner.
 *
 * Accepts TEST_DATABASE_URL only (never reads/exposes DATABASE_URL)
 * before launching migrate → seed → Jest pipeline. Fail-closed:
 * rejects non-loopback URLs or databases outside /synkroo_test.
 * Each step receives { cwd, stdio:'inherit', env } via execFileSync.
 *
 * Usage:
 *   node scripts/integration-run.mjs [-- jest-args...]
 *   npm run test:integration:run -- --listTests
 *
 * Exports (ESM):
 *   validateTestDatabaseUrl(url)    — validate + return URL or throw
 *   commandOptions(testUrl)          — defaults for execFileSync
 *   run(execute, testUrl, jestArgs)  — full pipeline, synchronous
 */

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Constants ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// ── URL validation ───────────────────────────────────────────────────────────

/**
 * Validates a test database URL is safe for destructive operations.
 *
 * Rules:
 *  - Must be a defined, non-empty string
 *  - Hostname must be a loopback address (localhost, 127.0.0.1, ::1)
 *  - Pathname (database name) must be exactly /synkroo_test
 *
 * @param {string|undefined|null} url
 * @returns {string} The validated URL
 * @throws {Error} If URL is missing, remote, or wrong database
 */
export function validateTestDatabaseUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    throw new Error('TEST_DATABASE_URL is required — set the TEST_DATABASE_URL environment variable');
  }

  const trimmed = url.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid TEST_DATABASE_URL: ${trimmed}`);
  }

  const hostname = parsed.hostname;
  const hostOk =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';

  if (!hostOk) {
    throw new Error(
      `TEST_DATABASE_URL must point to loopback (localhost/127.0.0.1/::1), got: ${hostname}`,
    );
  }

  if (parsed.pathname !== '/synkroo_test') {
    throw new Error(
      `TEST_DATABASE_URL database must be exactly 'synkroo_test', got: ${parsed.pathname.replace(/^\//, '')}`,
    );
  }

  return trimmed;
}

// ── Command options ──────────────────────────────────────────────────────────

/**
 * Returns default execFileSync options for child processes.
 *
 * @param {string} testUrl Validated test database URL
 * @returns {{ cwd: string, stdio: string, env: Record<string,string|undefined> }}
 */
export function commandOptions(testUrl) {
  return {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
    },
  };
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Runs the full integration test pipeline synchronously:
 *   1. npm run db:migrate
 *   2. node scripts/seed-test-clinic.mjs
 *   3. jest --config jest.integration.config.js [jestArgs...]
 *
 * Each step uses execFileSync with stdio:'inherit' and DATABASE_URL in env.
 * If any step throws, subsequent steps are skipped and error propagates.
 *
 * @param {Function} execute  execFileSync-compatible function
 * @param {string}   testUrl  TEST_DATABASE_URL value to validate
 * @param {string[]} jestArgs Extra arguments forwarded to Jest
 * @returns {void}
 */
export function run(execute = execFileSync, testUrl = process.env.TEST_DATABASE_URL, jestArgs = process.argv.slice(2)) {
  const validated = validateTestDatabaseUrl(testUrl);
  const opts = commandOptions(validated);

  // Step 1: Migrate
  execute(NPM_BIN, ['run', 'db:migrate'], opts);

  // Step 2: Seed
  execute(process.execPath, ['scripts/seed-test-clinic.mjs'], opts);

  // Step 3: Jest
  execute(NPM_BIN, ['exec', '--', 'jest', '--config', 'jest.integration.config.js', ...jestArgs], opts);
}

// ── Entrypoint ───────────────────────────────────────────────────────────────

// Only run as main script — inert on import
const isEntrypoint = process.argv[1] && (
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
);

if (isEntrypoint) {
  try {
    run();
  } catch (err) {
    console.error(`\n❌ integration-run: ${err.message}`);
    process.exit(1);
  }
}
