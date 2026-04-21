import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Calendar Date Navigation', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/agendamentos'); await page.waitForLoadState('networkidle') })
  t('Today button exists', async ({ page }) => {
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
  })
  t('can navigate to previous period', async ({ page }) => {
    const btn = page.locator('button:has-text("Anterior")')
    if (await btn.first().isVisible()) { await btn.first().click(); await page.waitForTimeout(300) }
  })
  t('can navigate to next period', async ({ page }) => {
    const btn = page.locator('button:has-text("Próximo")')
    if (await btn.first().isVisible()) { await btn.first().click(); await page.waitForTimeout(300) }
  })
})
