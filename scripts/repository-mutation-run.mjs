/**
 * scripts/repository-mutation-run.mjs — Repository mutation test runner.
 *
 * Pipeline: db:migrate → seed → Jest (security integration + coverage) → Stryker (repos)
 * Reuses validateTestDatabaseUrl and commandOptions from integration-run.mjs.
 *
 * Usage:
 *   node scripts/repository-mutation-run.mjs [-- jest-args...]
 *   npm run test:security:repositories
 *
 * Exports (ESM):
 *   validateTestDatabaseUrl(url) — from integration-run.mjs
 *   commandOptions(testUrl)       — from integration-run.mjs
 *   run(execute, testUrl, jestArgs) — full pipeline, synchronous
 */

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateTestDatabaseUrl,
  commandOptions,
} from './integration-run.mjs';

// ── Constants ────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// On Windows, execFileSync('npm.cmd') fails with EINVAL — use cmd.exe
const NPM_BIN = process.platform === 'win32'
  ? (process.env.ComSpec || 'cmd.exe')
  : 'npm';
const NPM_PREFIX = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd'] : [];

// Re-export for external consumers
export { validateTestDatabaseUrl, commandOptions };

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Runs the repository mutation pipeline synchronously:
 *   1. npm run db:migrate
 *   2. node scripts/seed-test-clinic.mjs
 *   3. jest --config jest.security.integration.config.js --coverage [jestArgs...]
 *   4. stryker run stryker.repositories.config.json
 *
 * Each step uses execFileSync with stdio:'inherit' and DATABASE_URL in env.
 * If any step throws, subsequent steps are skipped and error propagates.
 *
 * @param {Function} execute  execFileSync-compatible function
 * @param {string}   testUrl  TEST_DATABASE_URL value to validate
 * @param {string[]} jestArgs Extra arguments forwarded to Jest
 * @returns {void}
 */
export function run(
  execute = execFileSync,
  testUrl = process.env.TEST_DATABASE_URL,
  jestArgs = process.argv.slice(2),
) {
  const validated = validateTestDatabaseUrl(testUrl);
  const opts = commandOptions(validated);

  // Step 1: Migrate
  execute(NPM_BIN, [...NPM_PREFIX, 'run', 'db:migrate'], opts);

  // Step 2: Seed
  execute(process.execPath, ['scripts/seed-test-clinic.mjs'], opts);

  // Step 3: Jest (security integration + coverage)
  execute(NPM_BIN, [
    ...NPM_PREFIX, 'exec', '--', 'jest',
    '--config', 'jest.security.integration.config.js',
    '--coverage',
    ...jestArgs,
  ], opts);

  // Step 4: Stryker (repositories)
  execute(NPM_BIN, [
    ...NPM_PREFIX, 'exec', '--', 'stryker', 'run',
    'stryker.repositories.config.json',
  ], opts);
}

// ── Entrypoint ───────────────────────────────────────────────────────────────

const isEntrypoint = process.argv[1] && (
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
);

if (isEntrypoint) {
  try {
    run();
  } catch (err) {
    console.error(`\n❌ repository-mutation-run: ${err.message}`);
    process.exit(1);
  }
}
