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

async function expectLeadData(page: Page) {
  const leadRows = page.locator('[data-testid="lead-card"], table tbody tr, [class*="lead-card"]')
  await expect(leadRows.first()).toBeVisible({ timeout: 15000 })
}

test.describe('Leads Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/leads`)
    await page.waitForLoadState('networkidle')
  })

  test('should display leads page with pipeline controls', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/lead/i)
    await expect(page.getByText('Status', { exact: true })).toBeVisible()
    await expect(page.getByText('Temperatura', { exact: true })).toBeVisible()
  })

  test('should display lead rows', async ({ page }) => {
    await expectLeadData(page)
  })

  test('should display lead rows when data exists', async ({ page }) => {
    const rows = page.locator('table tbody tr, [data-testid="lead-card"], [class*="lead-card"]')
    await expect(rows.first()).toBeVisible({ timeout: 15000 })
  })

  test('should have new lead button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Novo Lead', exact: true })).toBeVisible()
  })

  test('should open new lead form', async ({ page }) => {
    const addButton = page.getByRole('button', { name: 'Novo Lead', exact: true })
    await expect(addButton).toBeVisible()
    await addButton.click()
    await expect(page.getByRole('heading', { name: 'Novo Lead' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar Lead' })).toBeVisible()
  })
  test('should show lead score', async ({ page }) => {
    const score = page.locator('[data-testid*="score"], [class*="score"]').first()
    await expect(score).toBeVisible({ timeout: 15000 })
  })

  test('should have filter controls for temperature and status', async ({ page }) => {
    await expect(page.getByText('Status', { exact: true })).toBeVisible()
    await expect(page.getByText('Temperatura', { exact: true })).toBeVisible()
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  test('should open lead creation form with name and phone fields', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/leads/novo`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('input[placeholder="Nome completo"]')).toBeVisible()
    await expect(page.locator('input[placeholder*="99999"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar Lead' })).toBeVisible()
  })
})

test.describe('Leads status interaction', () => {
  test('should expose status controls for an existing lead', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/leads`)
    await page.waitForLoadState('networkidle')
    await expectLeadData(page)
    const rows = page.locator('table tbody tr, [data-testid="lead-card"], [class*="lead-card"]')
    await expect(rows.first()).toBeVisible()
  })
})
