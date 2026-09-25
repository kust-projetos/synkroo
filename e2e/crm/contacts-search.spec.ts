import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
const contactSearch = 'input[placeholder="Buscar por nome, telefone ou email..."]'

async function expectContactList(page: import('@playwright/test').Page) {
  // Linhas de contato: button.w-full sem role (filtros Todos/Pacientes/Leads têm role="tab").
  const list = page.locator('main button.w-full:not([role="tab"])').first()
  await expect(list).toBeVisible({ timeout: 15000 })
}

t.describe('CRM Contacts - Search and Listing', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')
  })

  t('renders contacts list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Contatos' })).toBeVisible()
    await expectContactList(page)
  })

  t('renders search input', async ({ page }) => {
    await expect(page.locator(contactSearch).first()).toBeVisible()
  })

  t('search filters contacts by name', async ({ page }) => {
    const searchInput = page.locator(contactSearch).first()
    await expect(searchInput).toBeVisible()
    await searchInput.fill('zzz-nonexistent-contact')
    await expect(page.getByText('Nenhum contato encontrado')).toBeVisible()
  })

  t('renders patients list page', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toBeVisible()
  })

  t('renders leads list page', async ({ page }) => {
    await page.goto('/dashboard/leads')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2, [class*="PageHeader"]').first()).toBeVisible()
  })

  t('patients list has search functionality', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(contactSearch)).toBeVisible()
  })

  t('contacts list exposes type filters', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Todos' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Pacientes' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Leads' })).toBeVisible()
  })
})
