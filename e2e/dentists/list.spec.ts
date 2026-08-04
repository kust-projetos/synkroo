import { test, expect, Page } from '@playwright/test'
const BASE_URL = 'http://127.0.0.1:3003'

test.use({ storageState: { cookies: [], origins: [] } })

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#email', 'admin@clinicademo.com')
  await page.fill('#password', 'demo123')
  await Promise.all([
    page.waitForURL('**/dashboard**'),
    page.click('button[type="submit"]'),
  ])
}

const t = test.extend({})
t.describe('Dentists Page', () => {
  t.beforeEach(async ({ page }) => { await login(page); await page.goto(`${BASE_URL}/dashboard/dentistas`); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Dentistas') })
  t('renders Novo Dentista button', async ({ page }) => { await expect(page.locator('a[href="/dashboard/dentistas/novo"]')).toBeVisible() })
  t('renders search input', async ({ page }) => { await expect(page.locator('input[placeholder*="nome ou especialidade"]')).toBeVisible() })
})
