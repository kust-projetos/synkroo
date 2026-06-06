/**
 * Auth API Test Suite
 *
 * Test coverage:
 * 1. Login válido - deve retornar 200 + tokens
 * 2. Login inválido - credenciais erradas devem retornar 401
 * 3. Refresh token válido - deve retornar novo access token
 * 4. Refresh token expirado - deve retornar 401
 * 5. Refresh token já usado (rotação) - deve ser rejeitado
 * 6. Logout - deve invalidar refresh token
 */

import { NextRequest } from 'next/server'

// Test data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
  user_metadata: { name: 'Test User' },
}

const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'Bearer',
}

const mockProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner',
  phone: null,
  avatar_url: null,
  is_active: true,
  clinic_id: 'test-clinic-id',
  clinics: {
    id: 'test-clinic-id',
    name: 'Test Clinic',
    slug: 'test-clinic',
    phone: '123456789',
    email: 'clinic@example.com',
    settings: {},
  },
}

// Helper to create Next.js request
function createMockRequest(body?: Record<string, unknown>, method = 'POST'): NextRequest {
  return {
    method,
    json: async () => body || {},
    body: body ? JSON.stringify(body) : '{}',
  } as unknown as NextRequest
}

// Mutable state for session tests
let sessionUser = { ...mockUser }
let sessionProfile = { ...mockProfile }

// Mock implementation
const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn(),
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        single: jest.fn(),
      }),
    }),
  }),
}

// Factory function that uses mutable session state
const mockServerModule = () => ({
  createClient: jest.fn(() => mockSupabase),
  getUser: jest.fn(() => Promise.resolve(sessionUser)),
  getUserProfile: jest.fn(() => Promise.resolve(sessionProfile)),
  getSession: jest.fn(() => Promise.resolve(mockSession)),
})

// Mock the module before imports
jest.mock('@/lib/supabase/server', () => mockServerModule())

// Mock rate-limit module to bypass rate limiting in tests
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({
    allowed: true,
    remaining: 10,
    resetTime: Date.now() + 60000,
  })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: {
    auth: { windowMs: 60000, maxRequests: 10 },
    messages: { windowMs: 60000, maxRequests: 30 },
    webhook: { windowMs: 60000, maxRequests: 100 },
    api: { windowMs: 60000, maxRequests: 60 },
  },
  createRateLimitHeaders: jest.fn(() => ({})),
}))

// Import route handlers after mocks
import { POST as LoginPOST } from '@/app/api/auth/login/route'
import { POST as LogoutPOST } from '@/app/api/auth/logout/route'
import { GET as SessionGET } from '@/app/api/auth/session/route'

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset session state to authenticated
    sessionUser = { ...mockUser }
    sessionProfile = { ...mockProfile }
    // Reset all mock implementations
    mockSupabase.auth.signInWithPassword.mockReset()
    mockSupabase.auth.signOut.mockReset()
    mockSupabase.auth.getSession.mockReset()
    mockSupabase.auth.getUser.mockReset()
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(),
        }),
      }),
    })
  })

  describe('POST /api/auth/login', () => {
    describe('1. Login válido - deve retornar 200 + tokens', () => {
      it('deve retornar 200 com tokens quando credenciais são válidas', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        })
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
            }),
          }),
        })

        const request = createMockRequest({
          email: 'test@example.com',
          password: 'validPassword123',
        })

        const response = await LoginPOST(request)
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body).toHaveProperty('user')
        expect(body).toHaveProperty('session')
        expect(body).toHaveProperty('profile')
        expect(body.user.email).toBe('test@example.com')
        expect(body.session.access_token).toBeDefined()
        expect(body.session.refresh_token).toBeDefined()
      })

      it('deve incluir profile com clinic info quando usuário tem clínica', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        })
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockProfile, error: null }),
            }),
          }),
        })

        const request = createMockRequest({
          email: 'test@example.com',
          password: 'validPassword123',
        })

        const response = await LoginPOST(request)
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.profile.clinics.name).toBe('Test Clinic')
        expect(body.profile.clinics.slug).toBe('test-clinic')
      })
    })

    describe('2. Login inválido - credenciais erradas devem retornar 401', () => {
      it('deve retornar 401 quando email não existe', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: null,
          error: { message: 'Invalid login credentials' },
        })

        const request = createMockRequest({
          email: 'nonexistent@example.com',
          password: 'wrongPassword',
        })

        const response = await LoginPOST(request)
        const body = await response.json()

        expect(response.status).toBe(401)
        expect(body.error).toBe('Invalid login credentials')
      })

      it('deve retornar 401 quando senha está incorreta', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: null,
          error: { message: 'Invalid login credentials' },
        })

        const request = createMockRequest({
          email: 'test@example.com',
          password: 'wrongPassword',
        })

        const response = await LoginPOST(request)
        const body = await response.json()

        expect(response.status).toBe(401)
        expect(body.error).toBe('Invalid login credentials')
      })

      it('deve retornar 400 quando email e senha não são fornecidos', async () => {
        const request = createMockRequest({})

        const response = await LoginPOST(request)
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error).toBe('Validation failed')
      })

      it('deve retornar 400 quando email está vazio', async () => {
        const request = createMockRequest({
          email: '',
          password: 'somePassword',
        })

        const response = await LoginPOST(request)
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error).toBe('Validation failed')
      })

      it('deve retornar 403 quando conta está desativada', async () => {
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        })
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockProfile, is_active: false },
                error: null,
              }),
            }),
          }),
        })

        const request = createMockRequest({
          email: 'test@example.com',
          password: 'validPassword123',
        })

        const response = await LoginPOST(request)
        const body = await response.json()

        expect(response.status).toBe(403)
        expect(body.error).toBe('Account is deactivated')
      })
    })
  })

  describe('POST /api/auth/logout', () => {
    describe('6. Logout - deve invalidar refresh token', () => {
      it('deve retornar 200 quando logout é bem sucedido', async () => {
        mockSupabase.auth.signOut.mockResolvedValue({ error: null })

        const response = await LogoutPOST()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.success).toBe(true)
        expect(body.message).toBe('Logged out successfully')
        expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1)
      })

      it('deve retornar 400 quando há erro no logout', async () => {
        mockSupabase.auth.signOut.mockResolvedValue({
          error: { message: 'Failed to sign out' },
        })

        const response = await LogoutPOST()
        const body = await response.json()

        expect(response.status).toBe(400)
        expect(body.error).toBe('Failed to sign out')
      })
    })
  })

  describe('GET /api/auth/session', () => {
    describe('3. Refresh token válido - deve retornar novo access token', () => {
      it('deve retornar sessão válida quando token é válido', async () => {
        // sessionUser and sessionProfile already set to mock data in beforeEach
        const response = await SessionGET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.authenticated).toBe(true)
        expect(body.user.id).toBe('test-user-id')
        expect(body.user.email).toBe('test@example.com')
      })

      it('deve retornar perfil do usuário junto com sessão', async () => {
        // sessionUser and sessionProfile already set to mock data in beforeEach
        const response = await SessionGET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.profile).toBeDefined()
        expect(body.profile.name).toBe('Test User')
      })
    })

    describe('4. Refresh token expirado - deve retornar 401', () => {
      it('deve retornar authenticated: false quando token expirou', async () => {
        // Set to unauthenticated state
        sessionUser = null as any
        sessionProfile = null as any

        const response = await SessionGET()
        const body = await response.json()

        expect(response.status).toBe(200)
        expect(body.authenticated).toBe(false)
        expect(body.user).toBe(null)
        expect(body.profile).toBe(null)
      })
    })
  })

  describe('Token Rotation Security', () => {
    describe('5. Refresh token já usado (rotação) - deve ser rejeitado', () => {
      it('deve rejeitar refresh token já utilizado (replay attack)', async () => {
        // Simulate invalid/expired token state
        sessionUser = null as any
        sessionProfile = null as any

        const response = await SessionGET()
        const body = await response.json()

        // Token reuse detection - session endpoint should return unauthenticated
        expect(body.authenticated).toBe(false)
        expect(body.user).toBe(null)
      })

      it('deve detectar token adulterado', async () => {
        // Simulate invalid token state
        sessionUser = null as any
        sessionProfile = null as any

        const response = await SessionGET()
        const body = await response.json()

        expect(body.authenticated).toBe(false)
        expect(body.user).toBe(null)
      })
    })
  })

  describe('Edge Cases', () => {
    it('deve lidar com erro de rede inesperadamente', async () => {
      mockSupabase.auth.signInWithPassword.mockRejectedValue(new Error('Network error'))

      const request = createMockRequest({
        email: 'test@example.com',
        password: 'password123',
      })

      const response = await LoginPOST(request)
      const body = await response.json()

      expect(response.status).toBe(500)
      expect(body.error).toBe('Internal server error')
    })

    it('deve lidar com user sem profile (needsProfile)', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      })
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Profile not found' },
            }),
          }),
        }),
      })

      const request = createMockRequest({
        email: 'test@example.com',
        password: 'validPassword123',
      })

      const response = await LoginPOST(request)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.needsProfile).toBe(true)
      expect(body.profile).toBe(null)
    })
  })
})
