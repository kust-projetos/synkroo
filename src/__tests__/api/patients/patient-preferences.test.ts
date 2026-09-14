/**
 * Patient Preferences API Test Suite
 *
 * Test coverage:
 * 1. GET /api/patients/[id]/preferences — list preferences
 * 2. POST /api/patients/[id]/preferences — upsert a preference
 * 3. Auth guard — rejects unauthenticated requests
 * 4. Patient ownership — 404 if patient belongs to another clinic
 */

// ── Mocks ──────────────────────────────────────

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
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

// Mock validateApiAuth — valid session by default
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

// Rate-limit bypass
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { api: { windowMs: 60000, maxRequests: 60 } },
}));

// Mock auth session for getUserProfile (used by action routes)
jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ success: true, profile: mockProfile }),
  hasRequiredRole: jest.fn().mockReturnValue(true),
  getUserProfile: jest.fn().mockResolvedValue(mockProfile),
}));

// Mock manifest so buildUserContext can resolve enabledModules without hitting DB
jest.mock('@/core/modules/manifest', () => {
  const actual = jest.requireActual('@/core/modules/manifest')
  return {
    ...actual,
    drizzleManifestRepo: {
      getEnabledModuleIds: jest.fn().mockResolvedValue(['operacional']),
    },
    createManifest: () => ({
      isEnabled: jest.fn().mockResolvedValue(true),
      enabledModules: jest.fn().mockResolvedValue(new Set(['core', 'operacional'])),
  }),
  }
});

// Mock RBAC so buildUserContext → resolveAccess doesn't fail
jest.mock('@/core/rbac/repository', () => ({
  drizzleRbacRepo: {
    getAccess: jest.fn().mockResolvedValue({ isSystem: true, roleName: 'Owner', roleId: 'r1' }),
    getRolePermissions: jest.fn().mockResolvedValue([]),
    getOverrides: jest.fn().mockResolvedValue([]),
  },
}));

// ── Imports after mocks ────────────────────────

import { NextRequest } from 'next/server';
import { GET as PreferencesGET, POST as PreferencesPOST } from '@/app/api/patients/[id]/preferences/route';

// ── Helpers ─────────────────────────────────────

function resetMocks() {
  jest.clearAllMocks();
  // Reset all chain methods
  mockDb.select.mockReset();
  mockDb.from.mockReset();
  mockDb.where.mockReset();
  mockDb.limit.mockReset();
  mockDb.insert.mockReset();
  mockDb.values.mockReset();
  mockDb.update.mockReset();
  mockDb.set.mockReset();
  mockDb.returning.mockReset();
  mockDb.delete.mockReset();
  // Re-apply base chain returns (select/from return mockDb for chaining)
  mockDb.select.mockReturnValue(mockDb);
  mockDb.from.mockReturnValue(mockDb);
  mockDb.where.mockImplementation(() => mockDb); // terminal — override per call
  mockDb.limit.mockReturnValue(mockDb);
  mockDb.insert.mockReturnValue(mockDb);
  mockDb.values.mockReturnValue(mockDb);
  mockDb.update.mockReturnValue(mockDb);
  mockDb.set.mockReturnValue(mockDb);
  mockDb.returning.mockReturnValue(mockDb);
  mockDb.delete.mockReturnValue(mockDb);
}

const mockPatient = {
  id: 'patient-001',
  clinicId: 'test-clinic-id',
  name: 'João Silva',
  phone: '11999990001',
  email: 'joao@example.com',
  cpf: null,
  birthDate: null,
  gender: null,
  notes: null,
  tags: [] as string[],
  riskScore: null,
  lastVisitAt: null,
  createdAt: new Date(),
  deletedAt: null,
};

/** Build a NextRequest for the given path + body */
function makeReq(path: string, body?: unknown, method = 'GET'): NextRequest {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

/** Build route params for the patient ID */
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) } as { params: Promise<{ id: string }> };
}

describe('Patient Preferences API', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ─── GET /api/patients/[id]/preferences ───────────────────────

  describe('GET /api/patients/[id]/preferences', () => {
    it('deve retornar 404 quando paciente não existe', async () => {
      // Patient lookup: empty
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([]),
      });

      const req = makeReq('/api/patients/patient-001/preferences');
      const res = await PreferencesGET(req, makeParams('patient-001'));

      expect(res.status).toBe(404);
    });

    it('deve retornar 200 com lista de preferências do paciente', async () => {
      // Patient lookup: found (uses .limit(1))
      mockDb.where.mockImplementationOnce(() => ({
        limit: jest.fn().mockResolvedValue([mockPatient]),
      }));
      // Preferences query: uses .where() terminal (no limit) → use thenable
      mockDb.where.mockImplementationOnce(() =>
        new Promise(resolve => setImmediate(() => resolve([
          { id: 'pref-001', patientId: 'patient-001', clinicId: 'test-clinic-id', key: 'pref_saudacao', value: 'Sr.', category: 'general', updatedAt: new Date() },
          { id: 'pref-002', patientId: 'patient-001', clinicId: 'test-clinic-id', key: 'pref_horario', value: 'manhã', category: 'scheduling', updatedAt: new Date() },
        ])))
      );

      const req = makeReq('/api/patients/patient-001/preferences');
      const res = await PreferencesGET(req, makeParams('patient-001'));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.preferences).toBeDefined();
      expect(Array.isArray(json.data.preferences)).toBe(true);
      expect(json.data.preferences.length).toBe(2);
    });

    it('deve retornar 401 quando não autenticado', async () => {
      jest.resetModules();
      jest.doMock('@/lib/auth/session', () => ({
        validateApiAuth: jest.fn().mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } }),
      }));

      const { GET } = await import('@/app/api/patients/[id]/preferences/route');
      const req = makeReq('/api/patients/patient-001/preferences');
      const res = await GET(req, makeParams('patient-001'));
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/patients/[id]/preferences ─────────────────────

  describe('POST /api/patients/[id]/preferences', () => {
    it('deve retornar 400 quando campos requeridos faltam', async () => {
      // Patient lookup: found (needed so route doesn't 404 before validation)
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([mockPatient]),
      });

      const req = makeReq('/api/patients/patient-001/preferences', { key: 'foo' }, 'POST');
      const res = await PreferencesPOST(req, makeParams('patient-001'));

      expect(res.status).toBe(400);
    });

    it('deve retornar 404 quando paciente não existe', async () => {
      // Patient lookup: not found
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([]),
      });

      const req = makeReq('/api/patients/patient-001/preferences', {
        key: 'pref_test',
        value: 'test-value',
        category: 'general',
      }, 'POST');
      const res = await PreferencesPOST(req, makeParams('patient-001'));

      expect(res.status).toBe(404);
    });

    it('deve criar preferência (insert) e retornar 200', async () => {
      // Patient lookup: found
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([mockPatient]),
      });
      // setPreference: no existing pref found (select returns empty)
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([]),
      });
      // Insert: returns new pref
      mockDb.insert.mockReturnValueOnce(mockDb);
      mockDb.values.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([{
        id: 'pref-new',
        patientId: 'patient-001',
        clinicId: 'test-clinic-id',
        key: 'pref_test',
        value: 'test-value',
        category: 'general',
        updatedAt: new Date(),
      }]);

      const req = makeReq('/api/patients/patient-001/preferences', {
        key: 'pref_test',
        value: 'test-value',
        category: 'general',
      }, 'POST');
      const res = await PreferencesPOST(req, makeParams('patient-001'));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.preference).toBeDefined();
      expect(json.data.preference.key).toBe('pref_test');
    });

    it('deve atualizar preferência (update) existente e retornar 200', async () => {
      // Patient lookup: found
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([mockPatient]),
      });
      // setPreference: existing pref found (select returns row)
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([{ id: 'pref-existing', patientId: 'patient-001', key: 'pref_test' }]),
      });
      // Update: returns updated row
      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([{
        id: 'pref-existing',
        patientId: 'patient-001',
        clinicId: 'test-clinic-id',
        key: 'pref_test',
        value: 'updated-value',
        category: 'general',
        updatedAt: new Date(),
      }]);

      const req = makeReq('/api/patients/patient-001/preferences', {
        key: 'pref_test',
        value: 'updated-value',
        category: 'general',
      }, 'POST');
      const res = await PreferencesPOST(req, makeParams('patient-001'));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.preference).toBeDefined();
      expect(json.data.preference.value).toBe('updated-value');
    });

    it('deve retornar 500 quando setPreference retorna null', async () => {
      // Patient lookup: found
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([mockPatient]),
      });
      // setPreference: existing pref found but update returns nothing
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.from.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce({
        limit: jest.fn().mockResolvedValue([{ id: 'pref-existing' }]),
      });
      // Update returns empty
      mockDb.update.mockReturnValueOnce(mockDb);
      mockDb.set.mockReturnValueOnce(mockDb);
      mockDb.where.mockReturnValueOnce(mockDb);
      mockDb.returning.mockResolvedValueOnce([]);

      const req = makeReq('/api/patients/patient-001/preferences', {
        key: 'pref_test',
        value: 'updated-value',
        category: 'general',
      }, 'POST');
      const res = await PreferencesPOST(req, makeParams('patient-001'));

      expect(res.status).toBe(500);
    });
  });
});
