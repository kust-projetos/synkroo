/**
 * Inactive Patients API Route Test Suite
 *
 * F8a updated: route uses withModuleRoute + buildUserContext + runAction.
 * Tests:
 * 1. GET /api/patients/inactive — returns processed patients
 * 2. GET /api/patients/inactive — sanitizes null/undefined patient names
 * 3. Auth guard — 401 when buildUserContext throws 'unauthenticated'
 * 4. Auth guard — 403 when runAction returns forbidden
 * 5. stats_only — returns stats without patient list
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

// Rate-limit (always allowed in tests)
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { api: { windowMs: 60000, maxRequests: 60 } },
}));

// Module manifest — always enabled so withModuleRoute passes through
jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: {
    isEnabled: jest.fn().mockResolvedValue(true),
    enabledModules: jest.fn().mockResolvedValue(new Set(['followup', 'core'])),
  },
}));

// ── Action handler mocks ───────────────────────────────────────────────────────
// Real input schemas (safeParse) preserved; only handler mocked for data control.

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

// ── Context + runAction mocks ──────────────────────────────────────────────────

const mockCan = jest.fn().mockReturnValue(true);

jest.mock('@/core/actions/context', () => {
  const actual = jest.requireActual('@/core/actions/context');
  return {
    ...actual,
    buildUserContext: jest.fn().mockResolvedValue({
      source: 'user' as const,
      clinicId: 'test-clinic-id',
      user: { id: 'test-user-id', email: 'test@example.com', name: 'Test User' },
      role: 'owner' as string | undefined,
      can: mockCan,
      hasModule: jest.fn().mockReturnValue(true),
      audit: { actor: 'test-user-id' },
    }),
  };
});

jest.mock('@/core/actions/run', () => ({
  runAction: jest.fn(async (
    action: { input: { safeParse: (x: unknown) => any }; handler: (input: any, ctx: any) => any; requires: string },
    input: unknown,
    ctx: { can: (key: string) => boolean },
  ) => {
    // Simulate RBAC gate: if ctx.can(action.requires) is false → forbidden
    if (!ctx.can(action.requires)) {
      return { ok: false, error: { code: 'forbidden', message: 'Sem permissão.' } };
    }
    const parsed = action.input.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: { code: 'invalid_input', message: 'Dados inválidos.' } };
    }
    const data = await action.handler(parsed.data, ctx);
    return { ok: true, data };
  }),
}));

// ── Imports after all mocks ────────────────────────────────────────────────────

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/patients/inactive/route';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(path: string, method = 'GET'): NextRequest {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /api/patients/inactive', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: context can returns true
    mockCan.mockReturnValue(true);
    // Default: handlers succeed with empty results
    mockListarInativosHandler.mockResolvedValue({
      patients: [],
      pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    mockDetectarInativosHandler.mockResolvedValue({ processed: 1 });
    mockReativarPacienteHandler.mockResolvedValue({ success: true });
  });

  describe('auth guard', () => {
    it('returns 401 when buildUserContext throws unauthenticated', async () => {
      const { buildUserContext } = require('@/core/actions/context');
      buildUserContext.mockRejectedValueOnce(new Error('unauthenticated'));

      const req = makeReq('/api/patients/inactive');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 403 when runAction returns forbidden (RBAC denied)', async () => {
      mockCan.mockReturnValue(false);

      const req = makeReq('/api/patients/inactive');
      const res = await GET(req);

      expect(res.status).toBe(403);
    });
  });

  describe('data sanitization', () => {
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
