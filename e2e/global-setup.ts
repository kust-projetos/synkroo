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

  // Click submit — login API sets cookies, client-side router navigates
  await page.click('button[type="submit"]')

  // Wait for navigation to dashboard OR dashboard content to appear
  // Both indicate successful login
  await Promise.race([
    page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => null),
    page.waitForFunction(() => document.URL.includes('/dashboard'), { timeout: 20000 }).catch(() => null),
  ]).catch(() => { /* ignore timeout */ })

  // Extra wait: ensure page fully loaded before saving state
  await page.waitForTimeout(2000)

  await page.context().storageState({ path: AUTH_FILE })
  await browser.close()
}