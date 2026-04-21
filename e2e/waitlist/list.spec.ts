import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Waitlist Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/lista-espera'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('text=Lista de Espera')).toBeVisible() })
  t('renders status filter', async ({ page }) => { await expect(page.locator('text=Status')).toBeVisible() })
})
