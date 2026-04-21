import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Procedures Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/procedimentos'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Procedimentos') })
  t('renders Novo Procedimento button', async ({ page }) => { await expect(page.locator('a[href="/dashboard/procedimentos/novo"]')).toBeVisible() })
  t('renders search input', async ({ page }) => { await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible() })
})
