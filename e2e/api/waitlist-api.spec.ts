import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Waitlist API', () => {
  t('GET returns response', async ({ request }) => {
    const res = await request.get('/api/waitlist')
    expect(res.status()).toBeLessThan(500)
  })
})
