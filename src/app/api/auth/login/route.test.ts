import { NextRequest } from 'next/server'

const mockCheckRateLimit = jest.fn()
const mockGetClientIdentifier = jest.fn()

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
  rateLimitPresets: { auth: { windowMs: 60_000, maxRequests: 10 } },
}))

import { POST } from './route'

function request() {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'secret' }),
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
})

describe('POST /api/auth/login (stub — NextAuth owns credentials)', () => {
  it('keeps the 404 stub contract when under the limit', async () => {
    const response = await POST(request())

    expect(response.status).toBe(404)
    expect(mockCheckRateLimit).toHaveBeenCalledTimes(1)
  })

  it('returns 429 with Retry-After header only when the auth limit is exceeded', async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfter: 33,
    })

    const response = await POST(request())

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('33')
    expect(await response.json()).toEqual({
      error: expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
    })
  })
})
