import { GET } from './route'
import { requireActiveProfile } from '@/lib/auth/session'

jest.mock('@/lib/auth/session', () => ({
  requireActiveProfile: jest.fn(),
}))

const mockRequireActiveProfile = requireActiveProfile as jest.MockedFunction<typeof requireActiveProfile>

const activeProfile = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  role: 'owner',
  phone: null,
  avatar_url: null,
  is_active: true,
  session_version: 3,
  clinic_id: 'c1',
  clinics: null,
}

describe('GET /api/auth/session', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns the active profile from the canonical server guard', async () => {
    mockRequireActiveProfile.mockResolvedValue(activeProfile)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      authenticated: true,
      user: { id: 'u1', email: 'user@example.com' },
      profile: { id: 'u1', is_active: true, clinic_id: 'c1' },
    })
    expect(mockRequireActiveProfile).toHaveBeenCalledTimes(1)
  })

  it.each(['inactive', 'stale', 'database failure'])('fails closed for %s sessions', async () => {
    mockRequireActiveProfile.mockRejectedValue(new Error('Unauthorized'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ authenticated: false, user: null, profile: null })
  })
})
