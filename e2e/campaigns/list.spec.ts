import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Campaigns Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/campanhas'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Campanhas') })
  t('renders create campaign action', async ({ page }) => { await expect(page.getByRole('button', { name: 'Criar Campanha', exact: true })).toBeVisible() })
})
