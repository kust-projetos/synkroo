import { chromium, type FullConfig } from '@playwright/test'
import { testCredentials } from './fixtures/test-data'
import fs from 'node:fs/promises'
import path from 'node:path'

const AUTH_FILE = path.join(__dirname, '.auth', 'admin.json')
const BASE_URL = 'http://127.0.0.1:3003'

export default async function globalSetup(_config: FullConfig) {
  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const loginResponse = await page.goto(`${BASE_URL}/login`)
    if (!loginResponse || !loginResponse.ok()) throw new Error(`E2E setup login page failed: ${loginResponse?.status()}`)
    await page.fill('#email', testCredentials.email)
    await page.fill('#password', testCredentials.password)
    await Promise.all([
      page.waitForURL('**/dashboard**', { timeout: 20_000 }),
      page.click('button[type="submit"]'),
    ])
    const session = await page.evaluate(async () => {
      const response = await fetch('/api/auth/session')
      return { status: response.status, body: await response.json() }
    })
    if (session.status !== 200 || !session.body.authenticated) {
      throw new Error(`E2E setup session failed: status=${session.status}`)
    }
    const cookies = await page.context().cookies()
    if (!cookies.some((cookie) => cookie.name.endsWith('next-auth.session-token'))) {
      throw new Error('E2E setup did not produce a NextAuth session cookie')
    }
    await page.context().storageState({ path: AUTH_FILE })
  } finally {
    await browser.close()
  }
}
