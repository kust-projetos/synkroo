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
  // Serial execution — integration tests share a single Postgres instance
  // and must not run concurrently to avoid FK/unique constraint conflicts.
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
