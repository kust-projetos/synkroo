import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3003'

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`).catch(() => {})
  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@clinicademo.com', password: 'demo123' }),
    })
    return response.ok
  }).catch(() => false)
  expect(loginResult).toBe(true)
}

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/configuracoes`)
    await page.waitForLoadState('networkidle')
  })

  test('should display settings page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/configurações|settings|preferências/i)
  })

  test('should have settings navigation', async ({ page }) => {
    await page.waitForSelector('nav, [role="navigation"], [role="tablist"], aside', { timeout: 15000 }).catch(() => {})
    const hasNav = await page.locator('nav, [role="navigation"], [role="tablist"], aside').count() > 0
    expect(hasNav).toBeTruthy()
  })
})

test.describe('Clinic Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/configuracoes`)
    await page.waitForLoadState('networkidle')
  })

  test('should display settings page with clinic info', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/configurações/i)
  })

  test('should have settings form or cards', async ({ page }) => {
    await page.waitForSelector('form, [class*="card"], input, button', { timeout: 15000 }).catch(() => {})
    const hasContent = await page.locator('form, [class*="card"], input, button').count() > 0
    expect(hasContent).toBeTruthy()
  })
})

test.describe('Reminder Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/configuracao`)
    await page.waitForLoadState('networkidle')
  })

  test('should display reminder settings page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/lembretes|configuração/i)
  })

  test('should have notification settings', async ({ page }) => {
    await page.waitForSelector('form, input, button, [class*="switch"]', { timeout: 15000 }).catch(() => {})
    const hasContent = await page.locator('form, input, button, [class*="switch"]').count() > 0
    expect(hasContent).toBeTruthy()
  })
})