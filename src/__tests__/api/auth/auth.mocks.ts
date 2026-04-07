/**
 * Auth API Test Mocks
 *
 * Mocks for Supabase SSR and Next.js cookies
 */

// Mock cookies for Next.js
export const mockCookieStore = {
  getAll: jest.fn(() => []),
  set: jest.fn(),
  setAll: jest.fn(),
}

export const mockCookies = jest.fn(() => Promise.resolve(mockCookieStore))

// Mock session data
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00.000Z',
  user_metadata: { name: 'Test User' },
}

export const mockSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'Bearer',
}

export const mockProfile = {
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

// Helper to create mock Supabase client
export function createMockSupabaseClient(overrides: { auth?: Record<string, unknown>; [key: string]: unknown } = {}) {
  return {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({
        data: { session: mockSession },
        error: null,
      }),
      getUser: jest.fn().mockResolvedValue({
        data: { user: mockUser },
        error: null,
      }),
      ...overrides.auth,
    },
    ...overrides,
  }
}

// Error responses
export const mockErrors = {
  invalidCredentials: {
    message: 'Invalid login credentials',
  },
  userNotFound: {
    message: 'User not found',
  },
  refreshTokenExpired: {
    message: 'Refresh token expired',
  },
  refreshTokenUsed: {
    message: 'Refresh token already used',
  },
  invalidToken: {
    message: 'Invalid token',
  },
  networkError: new Error('Network error'),
}
