import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Analytics Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/analytics'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1:has-text("Analytics")')).toBeVisible() })
  t('renders chart sections', async ({ page }) => {
    await expect(page.locator('text=Distribuição por horário')).toBeVisible()
    await expect(page.locator('h2, h3:has-text("Tendências")').first()).toBeVisible()
  })
  t('renders no-show prediction', async ({ page }) => { await expect(page.locator('text=Previsão de No-Show')).toBeVisible() })
})
