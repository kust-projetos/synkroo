/**
 * Jest configuration for Synkroo
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
    // Testes co-localizados de rota/página (cron routes + dashboard pages).
    '**/route.test.ts',
    '**/page.test.ts',
    '**/page.test.tsx',
  ],
  // Integration tests run exclusively via `npm run test:integration`.
  // Exclude them from the default suite so hooks don't execute against mocked DB.
  testPathIgnorePatterns: ['/node_modules/', 'integration.test.ts'],
  transform: {
    '^.+\\.(?:ts|tsx|mjs)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
      },
    }],
  },
  // W4.8: @opennextjs/cloudflare usa ESM — incluir na transformação
  transformIgnorePatterns: [
    '/node_modules/(?!(@opennextjs/cloudflare)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.tsx',
    '!src/repositories/**',
    '!src/**/repositories/**',
    '!src/lib/db/**',
    '!src/**/schema/**',
    '!src/services/api-handlers/activities.ts',
    '!src/services/api-handlers/crm/**',
    '!src/services/api-handlers/cron/**',
    '!src/services/followup/dispatch-campaign-recipient.ts',
    '!src/services/api-handlers/campaigns/**',
    '!src/services/leads/**',
    '!src/**/ui/route-adapter.ts',
    '!src/modules/**/services/reminders-service.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 65,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testTimeout: 10000,
}