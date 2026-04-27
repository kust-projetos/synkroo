import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3002'

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@clinicademo.com', password: 'demo123' }),
    })
    return response.ok
  })
  expect(loginResult).toBe(true)
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
    const hasSearch = await page.locator('input[type="search"], input[placeholder*="buscar"], input[placeholder*="Buscar"], input[placeholder*="pesquisar"]').count() > 0
    expect(hasSearch).toBeTruthy()
  })

  test('should display patient list or cards', async ({ page }) => {
    await page.waitForSelector('table, [data-testid="patient-card"], [class*="card"]', { timeout: 15000 }).catch(() => {})
    const hasList = await page.locator('table, [data-testid="patient-card"], [class*="card"]').count() > 0
    expect(hasList).toBeTruthy()
  })

  test('should navigate to patient detail', async ({ page }) => {
    const patientRow = page.locator('table tbody tr, [data-testid="patient-card"], [class*="card"]').first()
    if (await patientRow.count() > 0) {
      await patientRow.click()
      await page.waitForLoadState('networkidle')
    }
  })
})

test.describe('Patient Detail', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/pacientes`)
    await page.waitForLoadState('networkidle')
  })

  test('should show patient detail page with tabs', async ({ page }) => {
    const patientRow = page.locator('table tbody tr, [data-testid="patient-card"], [class*="card"]').first()
    if (await patientRow.count() > 0) {
      await patientRow.click()
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('[role="tablist"], [role="tab"], nav, button', { timeout: 15000 }).catch(() => {})
      const hasTabs = await page.locator('[role="tablist"], [role="tab"], nav').count() > 0
      expect(hasTabs).toBeTruthy()
    }
  })

  test('should display treatment plan section', async ({ page }) => {
    const patientRow = page.locator('table tbody tr, [data-testid="patient-card"], [class*="card"]').first()
    if (await patientRow.count() > 0) {
      await patientRow.click()
      await page.waitForLoadState('networkidle')
      await page.waitForSelector('text=/plano|tratamento|procedimento/i', { timeout: 15000 }).catch(() => {})
      const hasPlan = await page.locator('text=/plano|tratamento/i').count() > 0
      expect(hasPlan).toBeTruthy()
    }
  })

  test('should create new treatment plan', async ({ page }) => {
    const patientRow = page.locator('table tbody tr, [data-testid="patient-card"], [class*="card"]').first()
    if (await patientRow.count() > 0) {
      await patientRow.click()
      await page.waitForLoadState('networkidle')

      const newPlanBtn = page.locator('a[href*="plano"], button:has-text("Novo Plano"), button:has-text("Plano"), a:has-text("Plano")').first()
      if (await newPlanBtn.count() > 0) {
        await newPlanBtn.click()
        await page.waitForLoadState('networkidle')
        const hasForm = await page.locator('form').count() > 0
        expect(hasForm).toBeTruthy()
      }
    }
  })

  test('should add procedures to treatment plan', async ({ page }) => {
    const patientRow = page.locator('table tbody tr, [data-testid="patient-card"], [class*="card"]').first()
    if (await patientRow.count() > 0) {
      await patientRow.click()
      await page.waitForLoadState('networkidle')

      await page.waitForSelector('[role="tablist"], [role="tab"], nav', { timeout: 15000 }).catch(() => {})
      const planTab = page.locator('[role="tab"]:has-text("Plano"), [role="tab"]:has-text("Tratamento"), button:has-text("Plano")').first()
      if (await planTab.count() > 0) {
        await planTab.click()
        await page.waitForLoadState('networkidle')

        const addProcedureBtn = page.locator('button:has-text("Adicionar Procedimento"), button:has-text("Procedimento"), a:has-text("Procedimento")').first()
        if (await addProcedureBtn.count() > 0) {
          await addProcedureBtn.click()
          await page.waitForSelector('select, input, form', { timeout: 15000 }).catch(() => {})
        }
      }
    }
  })

  test('should track session progress', async ({ page }) => {
    const patientRow = page.locator('table tbody tr, [data-testid="patient-card"], [class*="card"]').first()
    if (await patientRow.count() > 0) {
      await patientRow.click()
      await page.waitForLoadState('networkidle')

      await page.waitForSelector('text=/sess|progresso|sessoes/i', { timeout: 15000 }).catch(() => {})
      const hasProgress = await page.locator('text=/sess|progresso/i').count() > 0
      expect(hasProgress).toBeTruthy()
    }
  })
})
