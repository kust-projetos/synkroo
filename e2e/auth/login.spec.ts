import { test, expect } from '@playwright/test'
import { testCredentials } from '../fixtures/test-data'

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/login') })
  test('renders login form with email, password, and submit', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })
  test('shows demo credentials hint', async ({ page }) => {
    await expect(page.locator('text=Credenciais de Demo')).toBeVisible()
  })
  test('has link to signup page', async ({ page }) => {
    await expect(page.locator('a[href="/signup"]')).toBeVisible()
  })
  test('successful login redirects to /dashboard', async ({ page }) => {
    await page.fill('#email', testCredentials.email)
    await page.fill('#password', testCredentials.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 30000 })
    expect(page.url()).toContain('/dashboard')
  })
  test('wrong password shows error message', async ({ page }) => {
    await page.fill('#email', testCredentials.email)
    await page.fill('#password', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.locator('[class*="destructive"]').first()).toBeVisible({ timeout: 10000 })
  })
  test('empty fields prevent submission', async ({ page }) => {
    await page.click('button[type="submit"]')
    expect(page.url()).toContain('/login')
  })
  test('displays Synkroo branding', async ({ page }) => {
    await expect(page.locator('h1:has-text("Synkroo")')).toBeVisible()
  })
})
