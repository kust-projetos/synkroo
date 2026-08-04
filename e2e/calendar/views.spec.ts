import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Calendar Views', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/agendamentos'); await page.waitForLoadState('networkidle') })
  t('renders calendar grid', async ({ page }) => {
    await expect(page.locator('[class*="grid"], [class*="calendar"]')).toBeVisible({ timeout: 10000 })
  })
  t('can switch to Week view', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Semana', exact: true })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.locator('h2')).toBeVisible()
  })
  t('can switch to Month view', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Mês', exact: true })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.locator('h2')).toBeVisible()
  })
  t('can switch to Professionals view', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Profissionais', exact: true }).last()
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(page.locator('h2')).toBeVisible()
  })
})
