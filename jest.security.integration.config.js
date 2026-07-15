/**
 * Jest security integration config — focused coverage thresholds for repo/service DB code.
 */

process.env.RUN_INTEGRATION_TESTS = '1';

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/modules/followup/__tests__/inactive/integration.test.ts',
    '**/modules/financeiro/__tests__/installments-scope/integration.test.ts',
    '**/modules/financeiro/__tests__/collection-scope/integration.test.ts',
    '**/modules/crm/__tests__/duplicate-execution.integration.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
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
  collectCoverageFrom: [
    'src/modules/followup/actions/reativar-paciente.ts',
    'src/modules/followup/services/inactive-service.ts',
    'src/modules/financeiro/repositories/financeiro-scope-repository.ts',
    'src/modules/financeiro/repositories/installment-replacement-repository.ts',
    'src/modules/crm/repositories/merge-execution-repository.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: [],
  testTimeout: 15000,
};
