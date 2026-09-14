/**
 * Jest config for integration tests — skips jest.setup.ts
 * so DB modules load with real implementation.
 *
 * RUN_INTEGRATION_TESTS is set automatically here so callers don't need to.
 * Run with: npm run test:integration
 */

// Load local integration credentials for Jest; dotenv never logs or persists the value.
require('dotenv').config({ path: '.env.local', quiet: true });

// Set the flag before Jest initializes
process.env.RUN_INTEGRATION_TESTS = '1';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/integration.test.ts', '**/__tests__/**/*.integration.test.ts'],
  // Exclude actual node_modules directories only — avoid matching 'src\\modules' on Windows
  testPathIgnorePatterns: ['/node_modules/'],
  // Serial execution — MANDATORY, not a tuning knob. All integration suites
  // share ONE Postgres database and mutate GLOBAL state: `instance_modules`
  // (toggled by atendimento/gates, asserted via the real manifest by
  // core/actions), `channel_installations`, plus global unique indexes such as
  // messages(external_provider, external_message_id). Parallel workers turn
  // these into races by construction: a lookup that hits a row mid-mutation
  // (or a transient pool error under parallel load) fails closed — e.g. the
  // evolution webhook resolves to null and returns 403 instead of 200, or a
  // concurrent assignment observes ok=false. CI run 34840731189 showed exactly
  // this: atendimento/gates → 403 plus core/actions → ok=false in the same run.
  // Do NOT raise this or pass --maxWorkers/--runInBand overrides on the CLI:
  // caller flags override this config and silently reintroduce the race.
  // (FK/unique conflicts are the same root cause, one layer down.)
  maxWorkers: 1,
  transform: {
    '^.+\\.(?:ts|tsx|js|jsx|mjs)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  // uuid v14 is ESM-only; transform it for the CommonJS Jest runtime.
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: [],
  // No jest.setup.ts — real DB modules load naturally
  testTimeout: 30000,
};
