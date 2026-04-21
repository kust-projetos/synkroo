import { chromium, type FullConfig } from '@playwright/test'
import { testCredentials } from './fixtures/test-data'
import path from 'path'
const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json')
export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto('http://localhost:3003/login')
  await page.fill('#email', testCredentials.email)
  await page.fill('#password', testCredentials.password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 30000 })
  await page.context().storageState({ path: AUTH_FILE })
  await browser.close()
}
