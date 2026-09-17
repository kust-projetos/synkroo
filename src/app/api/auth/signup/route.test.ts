import { NextRequest } from 'next/server'
import { POST } from './route'
import { createUserWithClinic, findUserByEmail } from '@/repositories/auth'

jest.mock('@/repositories/auth', () => ({
  createUserWithClinic: jest.fn(),
  findUserByEmail: jest.fn(),
}))

const mockCheckRateLimit = jest.fn()
const mockGetClientIdentifier = jest.fn()

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
  rateLimitPresets: { auth: { windowMs: 60_000, maxRequests: 10 } },
}))

const mockFindUserByEmail = findUserByEmail as jest.MockedFunction<typeof findUserByEmail>
const originalNodeEnv = process.env.NODE_ENV

function request() {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: 'new@example.com',
      password: 'password123',
      name: 'New User',
      clinicName: 'New Clinic',
    }),
  })
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    mockGetClientIdentifier.mockReturnValue('198.51.100.10')
    mockCheckRateLimit.mockReturnValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    })
  })

  afterEach(() => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv
    jest.clearAllMocks()
  })

  it('returns not found and does not touch persistence in production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

    const response = await POST(request())

    expect(response.status).toBe(404)
    expect(mockFindUserByEmail).not.toHaveBeenCalled()
  })

  it('keeps the duplicate-account response outside production', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
    mockFindUserByEmail.mockResolvedValue({ id: 'existing-user' })

    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mockFindUserByEmail).toHaveBeenCalledWith('new@example.com')
  })

  it('returns 429 with Retry-After header only when the auth limit is exceeded', async () => {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfter: 42,
    })

    const response = await POST(request())

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('42')
    expect(await response.json()).toEqual({
      error: expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
    })
    expect(mockFindUserByEmail).not.toHaveBeenCalled()
  })
})
