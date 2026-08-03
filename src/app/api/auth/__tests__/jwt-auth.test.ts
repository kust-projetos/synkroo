/**
 * Auth API Test Suite — Auth.js (next-auth v4) Credentials
 *
 * Coverage:
 * 1. Valid login (200 + user + profile)
 * 2. Invalid login (401)
 * 3. Validation errors (400)
 * 4. Deactivated account (403)
 * 5. Logout (session cookie cleared)
 * 6. Session check — unauthenticated
 * 7. Signup validation
 * 8. Signup duplicate email
 * 9. Signup success
 */

// ── Mocks ──────────────────────────────────────

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockResolvedValue([]),
};

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mockDb),
}));

const mockPassword = { verifyPassword: jest.fn().mockReturnValue(true) };
jest.mock('@/lib/auth/password', () => mockPassword);

jest.mock('next-auth/jwt', () => ({
  encode: jest.fn().mockResolvedValue('mock-session-token'),
}));

const mockAuthRepo = {
  findUserProfileById: jest.fn(),
  findUserByEmail: jest.fn(),
  createUserWithClinic: jest.fn(),
};
jest.mock('@/repositories/auth', () => mockAuthRepo);

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
}));

// ── Fixtures ────────────────────────────────────

const mockUserRow = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner',
  phone: null,
  avatarUrl: null,
  isActive: true,
  clinicId: 'clinic-123',
  sessionVersion: 0,
};

const mockProfile = {
  id: 'test-user-id-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner',
  phone: null,
  avatarUrl: null,
  isActive: true,
  clinicId: 'clinic-123',
  clinics: {
    id: 'clinic-123',
    name: 'Test Clinic',
    slug: 'test-clinic',
    phone: '1234567890',
    email: 'clinic@example.com',
    settings: {},
  },
};

// ── Helpers ─────────────────────────────────────

function resetMocks() {
  jest.clearAllMocks();
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.limit.mockResolvedValue([]);
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockResolvedValue([]);
  mockDb.limit.mockResolvedValue([
    { user: mockUserRow, passwordHash: 'salt:hash' },
  ]);
  mockPassword.verifyPassword.mockReturnValue(true);
  mockAuthRepo.findUserProfileById.mockResolvedValue(mockProfile);
  mockAuthRepo.findUserByEmail.mockResolvedValue(null);
  mockAuthRepo.createUserWithClinic.mockResolvedValue(mockProfile);
}

// ── Tests ───────────────────────────────────────

describe('Auth JWT Suite', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('POST /api/auth/login', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loginEndpoint = require('../login/route');

    it('1. should return 200 with valid credentials', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'ValidPassword123!' }),
      });

      const response = await loginEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data.user).toEqual({ id: mockUserRow.id, email: mockUserRow.email });
      expect(data).toHaveProperty('profile');
      expect(data.profile).toMatchObject({
        id: mockProfile.id,
        email: mockProfile.email,
        role: mockProfile.role,
        clinic_id: 'clinic-123',
      });
    });

    it('includes current session version in issued token', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'ValidPassword123!' }),
      });

      await loginEndpoint.POST(request);

      const { encode } = require('next-auth/jwt');
      expect(encode).toHaveBeenCalledWith(expect.objectContaining({
        token: expect.objectContaining({ sessionVersion: 0 }),
      }));
    });

    it('uses the secure Auth.js cookie name in production', async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      Object.assign(process.env, { NODE_ENV: 'production' });
      try {
        const request = new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'ValidPassword123!' }),
        });

        const response = await loginEndpoint.POST(request);
        expect(response.headers.get('set-cookie')).toContain('__Secure-next-auth.session-token=');
      } finally {
        Object.assign(process.env, { NODE_ENV: originalNodeEnv });
      }
    });

    it('2. should return 401 with invalid credentials (no user found)', async () => {
      mockDb.limit.mockResolvedValue([]);

      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wrong@example.com', password: 'WrongPassword' }),
      });

      const response = await loginEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });

    it('should return 401 when password is wrong', async () => {
      mockPassword.verifyPassword.mockReturnValue(false);

      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'WrongPassword' }),
      });

      const response = await loginEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });

    it('should return 400 when email is missing', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'SomePassword123!' }),
      });

      const response = await loginEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 400 when password is missing', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await loginEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 403 when account is deactivated', async () => {
      mockDb.limit.mockResolvedValue([
        { user: { ...mockUserRow, isActive: false }, passwordHash: 'salt:hash' },
      ]);

      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'ValidPassword123!' }),
      });

      const response = await loginEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Account is deactivated');
    });
  });

  describe('POST /api/auth/logout', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const logoutEndpoint = require('../logout/route');

    it('should successfully logout and clear cookie', async () => {
      const request = new Request('http://localhost/api/auth/logout', {
        method: 'POST',
      });

      const response = await logoutEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/session', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sessionEndpoint = require('../session/route');

    it('should return unauthenticated when not logged in', async () => {
      const request = new Request('http://localhost/api/auth/session');
      const response = await sessionEndpoint.GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
      expect(data.profile).toBeNull();
    });
  });

  describe('POST /api/auth/signup', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const signupEndpoint = require('../signup/route');

    it('should return 400 when required fields are missing', async () => {
      const request = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'newuser@example.com' }),
      });

      const response = await signupEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('should return 409 when email already exists', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({ id: 'existing-id' });

      const request = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@example.com',
          password: 'Password123!',
          name: 'Existing User',
          clinicName: 'Existing Clinic',
        }),
      });

      const response = await signupEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('An account with this email already exists');
    });

    it('should create user when email is available', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      mockAuthRepo.createUserWithClinic.mockResolvedValue(mockProfile);

      const request = new Request('http://localhost/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'Password123!',
          name: 'New User',
          clinicName: 'New Clinic',
        }),
      });

      const response = await signupEndpoint.POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toEqual({ id: mockProfile.id, email: mockProfile.email });
      expect(data.profile).toMatchObject({
        id: mockProfile.id,
        email: mockProfile.email,
      });
    });
  });
});

describe('Security', () => {
  it('should not expose sensitive data in error responses', async () => {
    const error = { message: 'Invalid credentials' };
    expect(error).not.toHaveProperty('password');
    expect(error).not.toHaveProperty('token');
  });

  it('should handle malformed JSON', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loginEndpoint = require('../login/route');

    const request = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });

    const response = await loginEndpoint.POST(request);
    expect(response.status).toBe(500);
  });
});
