import { NextRequest } from 'next/server'
import { isPublicPath, middleware } from '../middleware'

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn().mockResolvedValue(null),
}))

import { shouldRejectCsrf } from '@/lib/security/request-guards'

jest.mock('@/lib/security/request-guards', () => ({
  exceedsBodyLimit: jest.fn().mockReturnValue(false),
  shouldRejectCsrf: jest.fn().mockReturnValue(false),
}))

const mockShouldRejectCsrf = shouldRejectCsrf as jest.MockedFunction<typeof shouldRejectCsrf>

const originalNodeEnv = process.env.NODE_ENV

describe('signup production boundary', () => {
  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
    mockShouldRejectCsrf.mockReset().mockReturnValue(false)
  })

  it('returns not found for the production signup page', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    const response = await middleware(new NextRequest('http://localhost/signup'))

    expect(response.status).toBe(404)
  })
})
describe('cookie-authenticated custom auth routes', () => {
  it('applies Origin/CSRF guard outside Auth.js internals', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
    mockShouldRejectCsrf.mockReturnValue(true)

    const response = await middleware(new NextRequest('http://localhost/api/auth/switch-clinic', {
      method: 'POST',
      headers: { cookie: 'next-auth.session-token=present' },
    }))

    expect(response.status).toBe(403)
  })
})

describe('public route allowlist', () => {
  it.each([
    ['/api/auth/providers', true],
    ['/api/auth/csrf', true],
    ['/api/auth/callback/credentials', true],
    ['/api/financeiro/webhooks/asaas', true],
    ['/api/auth/signup', true],
    ['/api/auth/logout', false],
    ['/api/auth/switch-clinic', false],
    ['/api/financeiro/webhooks/unknown', false],
  ])('%s public=%s', (pathname, expected) => {
    expect(isPublicPath(pathname)).toBe(expected)
  })
})
