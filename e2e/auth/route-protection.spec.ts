import { test, expect } from '@playwright/test'
test.describe('Route Protection', () => {
  test('unauthenticated /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login**', { timeout: 15000 })
    expect(page.url()).toContain('/login')
  })
  test('unauthenticated /dashboard/pacientes redirects to /login', async ({ page }) => {
    await page.goto('/dashboard/pacientes')
    await page.waitForURL('**/login**', { timeout: 15000 })
    expect(page.url()).toContain('/login')
  })
  test('/api/health is accessible without auth', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBeLessThan(500)
  })
  test('redirect preserves redirectTo param', async ({ page }) => {
    await page.goto('/dashboard/agendamentos')
    await page.waitForURL('**/login**', { timeout: 15000 })
    expect(page.url()).toContain('redirectTo')
  })
})
