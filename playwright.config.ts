import { defineConfig, devices } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  globalSetup: path.join(__dirname, 'e2e/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'e2e/global-teardown.ts'),
  use: {
    baseURL: 'http://localhost:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
    },
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'e2e/.auth/admin.json'),
      },
      testIgnore: ['**/auth/**', '**/api/**'],
      dependencies: ['setup'],
    },
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/auth/**',
    },
    {
      name: 'api',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'e2e/.auth/admin.json'),
      },
      testMatch: '**/api/**',
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3003',
    url: 'http://localhost:3003',
    reuseExistingServer: true,
    timeout: 120000,
  },
})
