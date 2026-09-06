import { GET } from './route'
import { getSession, requireActiveProfile } from '@/lib/auth/session'
import { listUserClinics } from '@/repositories/auth'

jest.mock('@/lib/auth/session', () => ({
  getSession: jest.fn(),
  requireActiveProfile: jest.fn(),
}))
jest.mock('@/repositories/auth', () => ({
  listUserClinics: jest.fn(),
}))

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>
const mockRequireActiveProfile = requireActiveProfile as jest.MockedFunction<typeof requireActiveProfile>
const mockListUserClinics = listUserClinics as jest.MockedFunction<typeof listUserClinics>

const activeProfile = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  role: 'owner',
  role_id: 'owner-role',
  phone: null,
  avatar_url: null,
  is_active: true,
  session_version: 3,
  clinic_id: 'c1',
  clinics: null,
}

function requestWithCookie(cookie: string | null): Request {
  const headers = new Headers()
  if (cookie !== null) headers.set('cookie', cookie)
  return new Request('http://localhost/api/auth/session', { headers })
}

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockListUserClinics.mockResolvedValue([])
    mockGetSession.mockResolvedValue(null)
  })

  it('returns the active profile from the canonical server guard', async () => {
    mockRequireActiveProfile.mockResolvedValue(activeProfile)

    const response = await GET(requestWithCookie(null))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      authenticated: true,
      user: { id: 'u1', email: 'user@example.com' },
      profile: { id: 'u1', is_active: true, clinic_id: 'c1' },
    })
    expect(mockRequireActiveProfile).toHaveBeenCalledTimes(1)
  })

  it('returns 200 unauthenticated when there is no session and no session cookie (avoids CLIENT_FETCH_ERROR)', async () => {
    mockRequireActiveProfile.mockRejectedValue(new Error('Unauthorized'))
    mockGetSession.mockResolvedValue(null)

    const response = await GET(requestWithCookie(null))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ authenticated: false, user: null, profile: null })
  })

  it('returns 401 when the session object is non-null but has no user id', async () => {
    mockRequireActiveProfile.mockRejectedValue(new Error('Unauthorized'))
    mockGetSession.mockResolvedValue({ user: {} } as never)

    const response = await GET(requestWithCookie(null))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ authenticated: false, user: null, profile: null })
  })

  it.each([
    'next-auth.session-token=expired-token',
    '__Secure-next-auth.session-token=expired-token',
  ])('returns 401 when session is null but cookie %s is present', async (cookie) => {
    mockRequireActiveProfile.mockRejectedValue(new Error('Unauthorized'))
    mockGetSession.mockResolvedValue(null)

    const response = await GET(requestWithCookie(cookie))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ authenticated: false, user: null, profile: null })
  })

  it('returns 200 when session is null and only unrelated cookies are present', async () => {
    mockRequireActiveProfile.mockRejectedValue(new Error('Unauthorized'))
    mockGetSession.mockResolvedValue(null)

    const response = await GET(requestWithCookie('theme=dark; foo=bar'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ authenticated: false, user: null, profile: null })
  })

  it.each(['inactive', 'stale', 'database failure'])(
    'fails closed with 401 for %s sessions when a session exists',
    async () => {
      mockRequireActiveProfile.mockRejectedValue(new Error('Unauthorized'))
      mockGetSession.mockResolvedValue({
        user: { id: 'u1', email: 'user@example.com' },
      } as never)

      const response = await GET(requestWithCookie(null))
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body).toEqual({ authenticated: false, user: null, profile: null })
    },
  )
})
