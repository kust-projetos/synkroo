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
    baseURL: 'http://127.0.0.1:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'e2e/.auth/admin.json'),
      },
      testIgnore: ['**/auth/**', '**/api/**'],
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
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3003',
    url: 'http://127.0.0.1:3003/login',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      NEXTAUTH_URL: 'http://127.0.0.1:3003',
    },
  },
})
