import { test, expect } from '@playwright/test'
import path from 'node:path'

test.use({ storageState: path.join(__dirname, '..', '.auth', 'admin.json') })

test('global setup persists a real NextAuth session', async ({ context, request }) => {
  const cookies = await context.cookies()
  expect(cookies.some((cookie) => cookie.name.endsWith('next-auth.session-token'))).toBe(true)
  const response = await request.get('/api/auth/session')
  expect(response.status()).toBe(200)
  expect((await response.json()).authenticated).toBe(true)
})
