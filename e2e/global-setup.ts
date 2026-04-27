import { chromium, type FullConfig } from '@playwright/test'
import { testCredentials } from './fixtures/test-data'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json')

export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  // Navigate to login page
  await page.goto('http://localhost:3003/login')

  // Fill login form
  await page.fill('#email', testCredentials.email)
  await page.fill('#password', testCredentials.password)

  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL('**/dashboard**', { timeout: 30000 }),
    page.click('button[type="submit"]')
  ])

  // Wait for page to be fully loaded
  await page.waitForLoadState('networkidle')

  await page.context().storageState({ path: AUTH_FILE })
  await browser.close()
}