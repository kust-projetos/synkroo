/**
 * Operational module integration test runner.
 * Invokes Jest with integration settings (real DB, no jest.setup.ts mocks).
 *
 * Usage:
 *   node scripts/run-operacional-integration.mjs
 *   node scripts/run-operacional-integration.mjs --watch
 */

import { spawn } from 'child_process';
import { resolve } from 'path';

const rootDir = resolve(import.meta.filename, '..', '..');
const testFile = process.argv.includes('--watch')
  ? 'src/modules/operacional'
  : 'src/modules/operacional/actions/__tests__/scheduling.integration.test.ts';

const jestArgs = [
  '--config', resolve(rootDir, 'jest.integration.config.js'),
  '--no-cache',
  testFile,
  ...process.argv.filter((a) => !a.startsWith('scripts/')),
];

console.log('> RUN_INTEGRATION_TESTS=1 node', 'jest', jestArgs.join(' '), '\n');

const child = spawn(
  'node',
  ['node_modules/jest/bin/jest.js', ...jestArgs],
  {
    cwd: rootDir,
    env: {
      ...process.env,
      RUN_INTEGRATION_TESTS: '1',
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo',
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code) => process.exit(code ?? 0));
