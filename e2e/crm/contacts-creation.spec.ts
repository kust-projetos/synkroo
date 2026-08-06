import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

async function fillRequiredContactFields(page: import('@playwright/test').Page, name: string, namePlaceholder: string) {
  const nameInput = page.locator(`input[placeholder="${namePlaceholder}"]`).first()
  const phoneInput = page.locator('input[placeholder*="99999"]').first()
  await expect(nameInput).toBeVisible()
  await expect(phoneInput).toBeVisible()
  await nameInput.fill(name)
  await phoneInput.fill('11999990000')
  await expect(page.getByRole('button', { name: /Salvar (Lead|Paciente)/ })).toBeVisible()
}

t.describe('CRM Contacts - Creation', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/contatos')
    await page.waitForLoadState('networkidle')
  })

  t('renders contacts page', async ({ page }) => {
    await expect(page).toHaveURL(/.*dashboard\/contatos/)
    await expect(page.locator('h1, h2').first()).toBeVisible()
  })

  t('keeps the contact list read-only', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Novo Contato', exact: true })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Contatos' })).toBeVisible()
  })

  t('creates new lead with basic info', async ({ page }) => {
    await page.goto('/dashboard/leads/novo')
    await page.waitForLoadState('networkidle')
    await fillRequiredContactFields(page, `Lead Test ${Date.now()}`, 'Nome completo')
    await page.getByRole('button', { name: 'Salvar Lead' }).click()
    await expect(page).toHaveURL(/dashboard\/leads\/.+/)
  })

  t('creates new patient with basic info', async ({ page }) => {
    await page.goto('/dashboard/pacientes/novo')
    await page.waitForLoadState('networkidle')
    await fillRequiredContactFields(page, `Paciente Test ${Date.now()}`, 'Nome do paciente')
    await page.getByRole('button', { name: 'Salvar Paciente' }).click()
    await expect(page).toHaveURL(/dashboard\/pacientes\/.+/)
  })

  t('validates required fields on contact creation', async ({ page }) => {
    await page.goto('/dashboard/leads/novo')
    await page.waitForLoadState('networkidle')
    const submitBtn = page.getByRole('button', { name: 'Salvar Lead' })
    await expect(submitBtn).toBeVisible()
    await submitBtn.click()
    await expect(page.getByText('Nome e telefone são obrigatórios')).toBeVisible()
  })
})
