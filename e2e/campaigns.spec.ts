import { test, expect, type Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3003'

test.use({ storageState: { cookies: [], origins: [] } })

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('#email', 'admin@clinicademo.com')
  await page.fill('#password', 'demo123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/)
}

test.describe('Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/campanhas`)
    await page.waitForLoadState('networkidle')
  })

  test('shows factual page state and create action', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/campanhas/i)
    await expect(page.getByRole('button', { name: 'Criar Campanha', exact: true })).toBeVisible()
    await expect(page.locator('table, [data-testid*="campaign"], text=/sem|nenhum|vazio/i').first()).toBeVisible()
  })

  test('opens campaign wizard', async ({ page }) => {
    await page.getByRole('button', { name: 'Criar Campanha', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('Campaign wizard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/campanhas`)
    await page.getByRole('button', { name: 'Criar Campanha', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('exposes campaign fields and audience controls', async ({ page }) => {
    await expect(page.locator('input[name*="name" i], input[name*="title" i], input[placeholder*="nome" i], input[placeholder*="campanha" i]').first()).toBeVisible()
    await expect(page.locator('textarea, input[name*="message" i], input[placeholder*="mensagem" i]').first()).toBeVisible()
    await expect(page.locator('select, input[type="checkbox"], [data-testid*="audience"]').first()).toBeVisible()
  })
})
