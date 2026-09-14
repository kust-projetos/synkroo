import { test, expect } from '@playwright/test'
test.describe('GET /api/health', () => {
  test('returns liveness status without DB dependency', async ({ request }) => {
    const response = await request.get('/api/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body).toHaveProperty('timestamp')
    expect(body).not.toHaveProperty('checks')
  })
})
