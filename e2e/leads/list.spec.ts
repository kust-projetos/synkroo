import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Leads Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/leads'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Leads') })
  t('renders Novo Lead button', async ({ page }) => { await expect(page.locator('a[href="/dashboard/leads/novo"]')).toBeVisible() })
  t('renders filters', async ({ page }) => { await expect(page.locator('text=Status')).toBeVisible() })
})
