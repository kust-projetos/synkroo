import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Settings Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/configuracoes'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('text=Configurações')).toBeVisible() })
  t('renders clinic form fields', async ({ page }) => {
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#phone')).toBeVisible()
  })
  t('renders save button', async ({ page }) => { await expect(page.locator('button:has-text("Salvar")')).toBeVisible() })
})
