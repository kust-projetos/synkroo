import { test, expect } from '@playwright/test'
test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/signup') })
  test('renders signup form with all fields', async ({ page }) => {
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('#clinicName')).toBeVisible()
  })
  test('has link to login page', async ({ page }) => {
    await expect(page.locator('a[href="/login"]')).toBeVisible()
  })
  test('empty fields prevent submission', async ({ page }) => {
    await page.click('button[type="submit"]')
    expect(page.url()).toContain('/signup')
  })
})
