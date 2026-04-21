import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Procedures API', () => {
  t('GET returns response', async ({ request }) => {
    const res = await request.get('/api/procedures')
    expect(res.status()).toBeLessThan(500)
  })
  t('POST with invalid data returns error', async ({ request }) => {
    const res = await request.post('/api/procedures', { data: {} })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})
