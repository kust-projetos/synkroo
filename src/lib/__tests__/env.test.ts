import { afterEach, describe, expect, it, jest } from '@jest/globals'

const originalEnv = process.env
const baseProductionEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  JWT_SECRET: 'jwt-placeholder-for-tests',
  WHATSAPP_VERIFY_TOKEN: 'verify-placeholder',
  WHATSAPP_APP_SECRET: 'app-secret-placeholder',
}

async function loadEnv(overrides: Record<string, string | undefined> = {}) {
  jest.resetModules()
  process.env = { ...baseProductionEnv, ...overrides }
  return import('../env')
}

afterEach(() => {
  jest.resetModules()
  process.env = originalEnv
})

describe('production environment auth secret', () => {
  it('rejects production without AUTH_SECRET', async () => {
    const { getEnv } = await loadEnv({ AUTH_SECRET: undefined })
    expect(() => getEnv()).toThrow(/AUTH_SECRET/)
  })

  it('rejects production with a short AUTH_SECRET', async () => {
    const { getEnv } = await loadEnv({ AUTH_SECRET: 'too-short' })
    expect(() => getEnv()).toThrow(/AUTH_SECRET/)
  })

  it('accepts production with a 32-character AUTH_SECRET', async () => {
    const { getEnv } = await loadEnv({ AUTH_SECRET: 'a'.repeat(32) })
    expect(getEnv().AUTH_SECRET).toBe('a'.repeat(32))
  })
})
