import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Calendar Date Navigation', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/agendamentos'); await page.waitForLoadState('networkidle') })
  t('Today button exists', async ({ page }) => {
    await expect(page.locator('button:has-text("Hoje")')).toBeVisible()
  })
  t('can navigate to previous period', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Anterior', exact: true })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.locator('h2')).toBeVisible()
  })
  t('can navigate to next period', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Proximo', exact: true })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.locator('h2')).toBeVisible()
  })
})
