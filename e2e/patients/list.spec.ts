import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Patients Page', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard/pacientes'); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toContainText('Pacientes') })
  t('renders Novo Paciente button', async ({ page }) => { await expect(page.locator('a[href="/dashboard/pacientes/novo"]')).toBeVisible() })
  t('renders search input', async ({ page }) => { await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible() })
  t('search filters results', async ({ page }) => {
    await page.locator('input[placeholder*="Buscar"]').fill('zzz-nonexistent')
    await page.locator('input[placeholder*="Buscar"]').press('Enter')
    await page.waitForLoadState('networkidle')
  })
})
