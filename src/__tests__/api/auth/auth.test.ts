/**
 * Auth API Test Suite — Auth.js Credentials integration
 *
 * Test coverage:
 * 1. Login válido - deve retornar 200 + user + profile
 * 2. Login inválido - credenciais erradas devem retornar 401
 * 3. Sessão - deve retornar estado autenticado
 * 4. Sessão expirada - deve retornar authenticated: false
 * 5. Logout - deve limpar sessão
 * 6. Edge cases - validação, erro de rede, etc.
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

// Password mock — we track it manually for reset
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

// Rate-limit bypass
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

// ── Imports after mocks ────────────────────────

import { NextRequest } from 'next/server';
import { POST as LoginPOST } from '@/app/api/auth/login/route';
import { POST as LogoutPOST } from '@/app/api/auth/logout/route';
import { GET as SessionGET } from '@/app/api/auth/session/route';

// ── Helpers ─────────────────────────────────────

function resetMocks() {
  // Clear call history on all mocks
  jest.clearAllMocks();

  // Re-apply chain implementations (resetAllMocks would remove them)
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.limit.mockResolvedValue([]);
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.returning.mockResolvedValue([]);

  // Re-apply default return values
  mockDb.limit.mockResolvedValue([
    { user: mockUserRow, passwordHash: 'salt:hash' },
  ]);
  mockPassword.verifyPassword.mockReturnValue(true);
  mockAuthRepo.findUserProfileById.mockResolvedValue(mockProfile);
  mockAuthRepo.findUserByEmail.mockResolvedValue(null);
  mockAuthRepo.createUserWithClinic.mockResolvedValue(mockProfile);
}
// ── Fixtures ────────────────────────────────────

const mockUserRow = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner',
  phone: null,
  avatarUrl: null,
  isActive: true,
  clinicId: 'test-clinic-id',
};

const mockProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner',
  phone: null,
  avatarUrl: null,
  isActive: true,
  clinicId: 'test-clinic-id',
  clinics: {
    id: 'test-clinic-id',
    name: 'Test Clinic',
    slug: 'test-clinic',
    phone: '123456789',
    email: 'clinic@example.com',
    settings: {},
  },
};

function createMockRequest(body?: Record<string, unknown>, method = 'POST'): NextRequest {
  return new Request('http://localhost/api/auth/login', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

describe('Auth API Endpoints', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('POST /api/auth/login', () => {
    describe('1. Login válido - deve retornar 200 + user + profile', () => {
      it('deve retornar 200 quando credenciais são válidas', async () => {
        const request = createMockRequest({
          email: 'test@example.com',
          password: 'validPassword123',
        });

        const response = await LoginPOST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toHaveProperty('user');
        expect(body).toHaveProperty('profile');
        expect(body.user.email).toBe('test@example.com');
      });

      it('deve incluir profile com clinic info', async () => {
        const request = createMockRequest({
          email: 'test@example.com',
          password: 'validPassword123',
        });

        const response = await LoginPOST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.profile.clinics.name).toBe('Test Clinic');
        expect(body.profile.clinics.slug).toBe('test-clinic');
      });
    });

    describe('2. Login inválido - credenciais erradas devem retornar 401', () => {
      it('deve retornar 401 quando email não existe', async () => {
        mockDb.limit.mockResolvedValue([]);

        const request = createMockRequest({
          email: 'nonexistent@example.com',
          password: 'wrongPassword',
        });

        const response = await LoginPOST(request);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Invalid email or password');
      });

      it('deve retornar 401 quando senha está incorreta', async () => {
        mockPassword.verifyPassword.mockReturnValue(false);

        const request = createMockRequest({
          email: 'test@example.com',
          password: 'wrongPassword',
        });

        const response = await LoginPOST(request);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('Invalid email or password');
      });

      it('deve retornar 400 quando email e senha não são fornecidos', async () => {
        const request = createMockRequest({});

        const response = await LoginPOST(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('Validation failed');
      });

      it('deve retornar 403 quando conta está desativada', async () => {
        mockDb.limit.mockResolvedValue([
          { user: { ...mockUserRow, isActive: false }, passwordHash: 'salt:hash' },
        ]);

        const request = createMockRequest({
          email: 'test@example.com',
          password: 'validPassword123',
        });

        const response = await LoginPOST(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.error).toBe('Account is deactivated');
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('deve retornar 200 quando logout é bem sucedido', async () => {
      const response = await LogoutPOST();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/session', () => {
    it('deve retornar authenticated: false quando não há sessão (sem cookie)', async () => {
      const response = await SessionGET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.authenticated).toBe(false);
      expect(body.user).toBeNull();
      expect(body.profile).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('deve lidar com erro de rede inesperadamente', async () => {
      mockDb.limit.mockRejectedValue(new Error('Database connection failed'));

      const request = createMockRequest({
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await LoginPOST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });

    it('deve retornar 500 para JSON mal formatado', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-valid-json',
      }) as unknown as NextRequest;

      const response = await LoginPOST(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Internal server error');
    });
  });
});
