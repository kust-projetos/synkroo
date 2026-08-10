import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://127.0.0.1:3003'

test.use({ storageState: { cookies: [], origins: [] } })

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#email', 'admin@clinicademo.com')
  await page.fill('#password', 'demo123')
  await Promise.all([
    page.waitForURL('**/dashboard**'),
    page.click('button[type="submit"]'),
  ])
}

async function openPatient(page: Page): Promise<void> {
  const patientLink = page.getByRole('link', { name: 'Ver', exact: true }).first()
  await expect(patientLink).toBeVisible({ timeout: 15000 })
  await patientLink.click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByRole('tab', { name: /Informações/i }).first()).toBeVisible()
}

test.describe('Patients Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/pacientes`)
    await page.waitForLoadState('networkidle')
  })

  test('should display patients list page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/pacientes/i)
  })

  test('should have search functionality', async ({ page }) => {
    await expect(page.locator('input[placeholder="Buscar por nome, telefone ou email..."]')).toBeVisible()
  })

  test('should display patient list', async ({ page }) => {
    const patients = page.locator('table tbody tr, [data-testid="patient-card"], [class*="patient-card"]')
    await expect(patients.first()).toBeVisible({ timeout: 15000 })
  })

  test('should navigate to patient detail', async ({ page }) => {
    await openPatient(page)
    await expect(page.locator('h1, h2').first()).toBeVisible()
    await expect(page.getByRole('tab', { name: /Informações/i })).toBeVisible()
  })
})

test.describe('Patient Detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/pacientes`)
    await page.waitForLoadState('networkidle')
  })

  test('should show patient detail page with tabs', async ({ page }) => {
    await openPatient(page)
    await expect(page.getByRole('tab', { name: /Informações/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Agendamentos/i })).toBeVisible()
  })

  test('should display patient information or appointment empty state', async ({ page }) => {
    await openPatient(page)
    await expect(page.getByText('Telefone', { exact: true })).toBeVisible()
    const appointments = page.getByRole('tab', { name: /Agendamentos/i })
    await appointments.click()
    await expect(page.getByText(/Nenhum agendamento encontrado|Data\/Hora/).first()).toBeVisible()
  })

  test('should expose appointment creation from empty patient schedule', async ({ page }) => {
    await openPatient(page)
    await page.getByRole('tab', { name: /Agendamentos/i }).click()
    const appointmentLink = page.getByRole('link', { name: /Agendar consulta/i })
    const appointmentTable = page.getByText('Data/Hora', { exact: true })
    await expect(appointmentLink.or(appointmentTable)).toBeVisible()
  })

  test('should expose patient edit action', async ({ page }) => {
    await openPatient(page)
    await expect(page.getByRole('link', { name: 'Editar' }).first()).toBeVisible()
  })
})
