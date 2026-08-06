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

async function expectSettingsContent(page: Page) {
  await expect(page.locator('form, [class*="card"], input, button').first()).toBeVisible()
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
    await expect(page.locator('nav, [role="navigation"], [role="tablist"], aside').first()).toBeVisible()
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
    await expectSettingsContent(page)
  })
})

test.describe('Reminder Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/dashboard/configuracao`)
    await page.waitForLoadState('networkidle')
  })

  test('should display reminder settings page', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/configurações/i)
  })

  test('should have notification settings', async ({ page }) => {
    await expect(page.locator('form, input, button, [class*="switch"]').first()).toBeVisible()
  })
})
