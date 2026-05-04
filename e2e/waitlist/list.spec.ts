import { test, expect, Page } from '@playwright/test'
const BASE_URL = 'http://localhost:3003'

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

const t = test.extend({})
t.describe('Waitlist Page', () => {
  t.beforeEach(async ({ page }) => { await login(page); await page.goto(`${BASE_URL}/dashboard/lista-espera`); await page.waitForLoadState('networkidle') })
  t('renders page header', async ({ page }) => { await expect(page.locator('h1:has-text("Lista de Espera")')).toBeVisible() })
  t('renders status filter', async ({ page }) => { await expect(page.locator('text=Status')).toBeVisible() })
})
