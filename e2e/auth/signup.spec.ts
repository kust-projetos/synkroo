import { test, expect } from '@playwright/test'

const IS_PRODUCTION = process.env.E2E_PRODUCTION === '1'
// Em produção /signup é 404 deliberado (ADR-BASE-11); form só existe em dev.
const PROD_SKIP_REASON = 'ADR-BASE-11: /signup retorna 404 em produção'

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/signup') })
  test('renders signup form with all fields', async ({ page }) => {
    test.skip(IS_PRODUCTION, PROD_SKIP_REASON)
    await expect(page.locator('#name')).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.locator('#clinicName')).toBeVisible()
  })
  test('has link to login page', async ({ page }) => {
    test.skip(IS_PRODUCTION, PROD_SKIP_REASON)
    await expect(page.locator('a[href="/login"]')).toBeVisible()
  })
  test('empty fields prevent submission', async ({ page }) => {
    test.skip(IS_PRODUCTION, PROD_SKIP_REASON)
    await page.click('button[type="submit"]')
    expect(page.url()).toContain('/signup')
  })
  test('production blocks signup (ADR-BASE-11 guard)', async ({ page }) => {
    if (IS_PRODUCTION) {
      const response = await page.goto('/signup')
      expect(response?.status()).toBe(404)
    } else {
      await expect(page.locator('#name')).toBeVisible()
    }
  })
})
