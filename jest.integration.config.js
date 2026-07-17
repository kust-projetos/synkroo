/**
 * Jest config for integration tests — skips jest.setup.ts
 * so DB modules load with real implementation.
 *
 * RUN_INTEGRATION_TESTS is set automatically here so callers don't need to.
 * Run with: npm run test:integration
 */

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
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: [],
  // No jest.setup.ts — real DB modules load naturally
  testTimeout: 10000,
};
