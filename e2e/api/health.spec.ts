import { test, expect } from '@playwright/test'
test.describe('GET /api/health', () => {
  test('returns health status', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBeLessThan(500)
    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks')
  })
  test('includes database check', async ({ request }) => {
    const body = await (await request.get('/api/health')).json()
    expect(body.checks).toHaveProperty('database')
  })
})
