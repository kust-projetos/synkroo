import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Conversations Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/conversas'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Conversas') })
  t('renders conversation area', async ({ page }) => {
    const hasList = await page.locator('[class*="overflow"]').isVisible()
    const hasEmpty = await page.locator('text=Nenhuma conversa').isVisible()
    expect(hasList || hasEmpty).toBeTruthy()
  })
})
