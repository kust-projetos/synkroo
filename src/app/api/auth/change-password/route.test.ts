import { NextRequest } from 'next/server'

const mockValidateApiAuth = jest.fn()
const mockChangeUserPassword = jest.fn()
const mockCheckRateLimit = jest.fn()
const mockGetClientIdentifier = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}))
jest.mock('@/repositories/auth', () => ({
  changeUserPassword: (...args: unknown[]) => mockChangeUserPassword(...args),
}))
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
  createRateLimitHeaders: (remaining: number, resetTime: number, limit: number) => ({
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
  }),
  rateLimitPresets: { auth: { windowMs: 60_000, maxRequests: 10 } },
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetClientIdentifier.mockReturnValue('198.51.100.10')
  mockCheckRateLimit.mockReturnValue({
    allowed: true,
    remaining: 9,
    resetTime: Date.now() + 60_000,
  })
  mockValidateApiAuth.mockResolvedValue({
    success: true,
    user: { id: 'user-1', email: 'user@example.com' },
  })
  mockChangeUserPassword.mockResolvedValue({ ok: true })
})

describe('POST /api/auth/change-password', () => {
  it('returns 429 before authentication when the client rate limit is exceeded', async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: 1_700_000_060_000,
      retryAfter: 17,
    })

    const response = await POST(request({ currentPassword: 'oldpass', nextPassword: 'newpass' }))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('17')
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10')
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0')
    expect(await response.json()).toEqual({ error: 'Too many requests' })
    expect(mockValidateApiAuth).not.toHaveBeenCalled()
    expect(mockChangeUserPassword).not.toHaveBeenCalled()
  })

  it('changes the authenticated user password', async () => {
    const response = await POST(request({ currentPassword: 'oldpass', nextPassword: 'newpass' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(mockChangeUserPassword).toHaveBeenCalledWith('user-1', 'oldpass', 'newpass')
  })

  it('returns 403 when the current password is invalid', async () => {
    mockChangeUserPassword.mockResolvedValue({ ok: false, reason: 'invalid_current_password' })

    const response = await POST(request({ currentPassword: 'wrongpass', nextPassword: 'newpass' }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Current password is incorrect' })
  })

  it('returns 400 for invalid password input', async () => {
    const response = await POST(request({ currentPassword: 'short', nextPassword: 'short' }))

    expect(response.status).toBe(400)
    expect(mockChangeUserPassword).not.toHaveBeenCalled()
  })

  it('returns the authentication error without calling the repository', async () => {
    mockValidateApiAuth.mockResolvedValue({
      success: false,
      error: { message: 'Unauthorized', status: 401 },
    })

    const response = await POST(request({ currentPassword: 'oldpass', nextPassword: 'newpass' }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mockChangeUserPassword).not.toHaveBeenCalled()
  })
})
