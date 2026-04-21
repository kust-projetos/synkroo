import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Appointments API', () => {
  t('GET returns list', async ({ request }) => {
    const res = await request.get('/api/appointments?limit=5')
    expect(res.status()).toBeLessThan(500)
    const body = await res.json()
    expect(body).toHaveProperty('appointments')
  })
  t('GET supports date range', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(`/api/appointments?start_date=${today}&end_date=${today}`)
    expect(res.status()).toBeLessThan(500)
  })
  t('POST with invalid data returns error', async ({ request }) => {
    const res = await request.post('/api/appointments', { data: {} })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})
