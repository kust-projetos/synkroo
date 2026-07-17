/**
 * Jest security config — focused coverage thresholds for security-critical files.
 * Spreads base jest.config and overrides testMatch/coverage.
 */

const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: [
    '**/__tests__/api/tasks/route.test.ts',
    '**/__tests__/api/budgets/installments/route.test.ts',
    '**/__tests__/api/instagram/webhook/contract.test.ts',
    '**/modules/financeiro/services/__tests__/budget-scope-service.test.ts',
    '**/modules/financeiro/services/__tests__/collection-service.test.ts',
    '**/modules/financeiro/services/__tests__/installment-service.test.ts',
    '**/modules/crm/__tests__/duplicate-execution-service.test.ts',
    '**/modules/operacional/services/__tests__/patient-merge-state-service.test.ts',
    '**/modules/comercial/services/__tests__/merge-state-service.test.ts',
  ],
  collectCoverageFrom: [
    'src/app/api/tasks/route.ts',
    'src/app/api/budgets/[id]/installments/route.ts',
    'src/app/api/instagram/webhook/route.ts',
    'src/modules/financeiro/services/budget-scope-service.ts',
    'src/modules/financeiro/services/collection-service.ts',
    'src/modules/financeiro/services/installment-service.ts',
    'src/modules/crm/services/duplicate-execution-service.ts',
    'src/modules/operacional/services/patient-merge-state-service.ts',
    'src/modules/comercial/services/merge-state-service.ts',
  ],
  coverageThreshold: {
    'src/app/api/tasks/route.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/app/api/budgets/[id]/installments/route.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/app/api/instagram/webhook/route.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/modules/financeiro/services/budget-scope-service.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/modules/financeiro/services/collection-service.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/modules/financeiro/services/installment-service.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/modules/crm/services/duplicate-execution-service.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/modules/operacional/services/patient-merge-state-service.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    'src/modules/comercial/services/merge-state-service.ts': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: [],
};
