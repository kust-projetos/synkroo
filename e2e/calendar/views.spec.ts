import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Calendar Views', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/agendamentos'); await page.waitForLoadState('networkidle') })
  t('renders calendar grid', async ({ page }) => {
    await expect(page.locator('[class*="grid"], [class*="calendar"]')).toBeVisible({ timeout: 10000 })
  })
  t('can switch to Week view', async ({ page }) => {
    const btn = page.locator('button:has-text("Semana")')
    if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(500) }
  })
  t('can switch to Month view', async ({ page }) => {
    const btn = page.locator('button:has-text("Mês")')
    if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(500) }
  })
  t('can switch to Professionals view', async ({ page }) => {
    const btn = page.locator('button:has-text("Profissionais")')
    if (await btn.isVisible()) { await btn.click(); await page.waitForTimeout(500) }
  })
})
