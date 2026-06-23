/**
 * Inactive Patients API Route Test Suite
 *
 * F4c migrated: route delegates to followup.listarInativos action handler
 * (service layer / Drizzle), no longer uses @/repositories/patients.
 *
 * Covers:
 * 1. GET /api/patients/inactive — returns processed patients
 * 2. GET /api/patients/inactive — sanitizes null/undefined patient names
 * 3. Auth guard — rejects unauthenticated requests
 * 4. Role guard — rejects insufficient role
 */

// ── Mocks ──────────────────────────────────────

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mockDb),
}));

const mockProfile = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: 'owner' as const,
  phone: null,
  avatarUrl: null,
  isActive: true,
  clinic_id: 'test-clinic-id',
};

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ success: true, profile: mockProfile }),
  hasRequiredRole: jest.fn().mockReturnValue(true),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { api: { windowMs: 60000, maxRequests: 60 } },
}));

// ── Action handler mocks (route delegates to these) ─────────────────────────
// Use jest.requireActual so the real input schema (safeParse) is available;
// only the handler is mocked so tests control the data.

const mockListarInativosHandler = jest.fn();
const mockDetectarInativosHandler = jest.fn();
const mockReativarPacienteHandler = jest.fn();

jest.mock('@/modules/followup/actions', () => {
  const actual = jest.requireActual('@/modules/followup/actions') as typeof import('@/modules/followup/actions');
  return {
    ...actual,
    detectarInativos: { ...actual.detectarInativos, handler: mockDetectarInativosHandler },
    listarInativos: { ...actual.listarInativos, handler: mockListarInativosHandler },
    reativarPaciente: { ...actual.reativarPaciente, handler: mockReativarPacienteHandler },
  };
});

// ── Imports after mocks ────────────────────────

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/patients/inactive/route';

// ── Helpers ─────────────────────────────────────

function makeReq(path: string, method = 'GET'): NextRequest {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

// ── Tests ───────────────────────────────────────

describe('GET /api/patients/inactive', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: handlers succeed with empty results
    mockListarInativosHandler.mockResolvedValue({ patients: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
    mockDetectarInativosHandler.mockResolvedValue({ processed: 1 });
    mockReativarPacienteHandler.mockResolvedValue({ success: true });
  });

  describe('auth guard', () => {
    it('returns 401 when unauthenticated', async () => {
      const { validateApiAuth } = require('@/lib/auth/session');
      validateApiAuth.mockResolvedValueOnce({
        success: false,
        error: { message: 'Unauthorized', status: 401 },
      });

      const req = makeReq('/api/patients/inactive');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 403 when role is insufficient', async () => {
      const { hasRequiredRole } = require('@/lib/auth/session');
      hasRequiredRole.mockReturnValueOnce(false);

      const req = makeReq('/api/patients/inactive');
      const res = await GET(req);

      expect(res.status).toBe(403);
    });
  });

  describe('data sanitization', () => {
    // InactivePatient shape returned by listarInativos action handler
    const mockInactivePatient = (overrides: Record<string, unknown> = {}) => ({
      patientId: 'patient-001',
      patientName: 'João Silva',
      patientPhone: '11999990001',
      lastVisit: new Date('2026-01-15'),
      daysSinceLastVisit: 159,
      inactivitySegment: 'inactive_90',
      clinicId: 'test-clinic-id',
      clinicName: '',
      totalVisits: 3,
      lastProcedure: 'Limpeza',
      riskScore: 0.75,
      ...overrides,
    });

    it('returns patients with valid names', async () => {
      mockListarInativosHandler.mockResolvedValueOnce({
        patients: [mockInactivePatient({ patientName: 'João Silva' })],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const req = makeReq('/api/patients/inactive?min_days=30');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.patients[0].patientName).toBe('João Silva');
    });

    it('sanitizes null patient name to fallback string', async () => {
      mockListarInativosHandler.mockResolvedValueOnce({
        patients: [mockInactivePatient({ patientName: null as unknown as string })],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const req = makeReq('/api/patients/inactive?min_days=30');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      // Must not be null or undefined — the UI will call .charAt(0) on it
      expect(body.patients[0].patientName).toBeDefined();
      expect(body.patients[0].patientName).not.toBeNull();
      expect(typeof body.patients[0].patientName).toBe('string');
    });

    it('sanitizes undefined patient name to fallback string', async () => {
      mockListarInativosHandler.mockResolvedValueOnce({
        patients: [mockInactivePatient({ patientName: undefined as unknown as string })],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const req = makeReq('/api/patients/inactive?min_days=30');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.patients[0].patientName).toBeDefined();
      expect(body.patients[0].patientName).not.toBeNull();
      expect(typeof body.patients[0].patientName).toBe('string');
    });

    it('sanitizes empty string name — still passes but safe', async () => {
      mockListarInativosHandler.mockResolvedValueOnce({
        patients: [mockInactivePatient({ patientName: '' })],
        pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      const req = makeReq('/api/patients/inactive?min_days=30');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.patients[0].patientName).toBe('');
      // Even empty string won't crash .charAt(0) — it returns ''
    });

    it('returns stats_only without patient list', async () => {
      mockListarInativosHandler.mockResolvedValueOnce({
        patients: [
          mockInactivePatient({ patientName: 'Maria Souza' }),
          mockInactivePatient({ patientId: 'patient-002', patientName: 'Pedro Alves' }),
        ],
        pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
      });

      const req = makeReq('/api/patients/inactive?stats_only=true');
      const res = await GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.stats).toBeDefined();
      expect(body.stats.totalInactive).toBe(2);
      expect(body.patients).toBeUndefined();
    });
  });
});
