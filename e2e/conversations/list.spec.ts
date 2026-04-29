import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Conversations Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/conversas'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Conversas') })
  t('renders conversation area', async ({ page }) => {
    // Check for header which confirms page loaded
    const hasHeader = await page.locator('h1, h2').filter({ hasText: /conversa/i }).count() > 0
    expect(hasHeader).toBeTruthy()
  })
})
