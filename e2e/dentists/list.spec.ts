import { test, expect, Page } from '@playwright/test'
const BASE_URL = 'http://localhost:3003'

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@clinicademo.com', password: 'demo123' }),
    })
    return response.ok
  })
  expect(loginResult).toBe(true)
}

const t = test.extend({})
t.describe('Dentists Page', () => {
  t.beforeEach(async ({ page }) => { await login(page); await page.goto(`${BASE_URL}/dashboard/dentistas`); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Dentistas') })
  t('renders Novo Dentista button', async ({ page }) => { await expect(page.locator('a[href="/dashboard/dentistas/novo"]')).toBeVisible() })
  t('renders search input', async ({ page }) => { await expect(page.locator('input[placeholder*="nome ou especialidade"]')).toBeVisible() })
})
