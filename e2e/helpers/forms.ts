import type { Page } from '@playwright/test'
export async function fillField(page: Page, selector: string, value: string) { await page.fill(selector, value) }
export async function submitForm(page: Page) { await page.click('button[type="submit"]') }
export async function fillLoginForm(page: Page, email: string, password: string) {
  await page.fill('#email', email)
  await page.fill('#password', password)
}
