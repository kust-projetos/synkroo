import { test, expect } from '@playwright/test'
import path from 'path'
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
t.describe('Patients API', () => {
  t('GET returns list', async ({ request }) => {
    const res = await request.get('/api/patients?limit=5')
    expect(res.status()).toBeLessThan(500)
    const body = await res.json()
    const payload = body.data ?? body
    expect(payload).toHaveProperty('patients')
    expect(Array.isArray(payload.patients)).toBe(true)
  })
  t('POST with invalid data returns error', async ({ request }) => {
    const res = await request.post('/api/patients', { data: {} })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
  t('GET supports search', async ({ request }) => {
    const res = await request.get('/api/patients?search=nonexistent')
    expect(res.status()).toBeLessThan(500)
  })
})
