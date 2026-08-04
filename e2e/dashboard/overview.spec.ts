import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Dashboard Overview', () => {
  t.beforeEach(async ({ page }) => { await page.goto('/dashboard'); await page.waitForLoadState('networkidle') })
  t('shows welcome card', async ({ page }) => { await expect(page.locator('text=Bem-vindo')).toBeVisible() })
  t('renders primary stats', async ({ page }) => {
    await expect(page.locator('text=Agendamentos Hoje')).toBeVisible()
    await expect(page.locator('text=Taxa de Confirmação')).toBeVisible()
  })
  t('renders quick actions', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Novo Agendamento', exact: true })).toBeVisible()
    await expect(page.getByText('Mensagens', { exact: true })).toBeVisible()
  })
})
