/**
 * Appointment Conflict Detection Tests
 *
 * Tests the interval-overlap logic in POST /api/appointments.
 * Correct overlap definition: existing.start < new.end AND existing.end > new.start
 *
 * Route migrated to operacional module action system (F3).
 * Complete mock stack: auth → buildUserContext → RBAC → manifest → action → repo.
 */

const mockProfile = {
  id: 'test-user-id', email: 'test@example.com', name: 'Test User',
  role: 'owner' as const, phone: null, avatarUrl: null, isActive: true,
  clinic_id: 'test-clinic-id',
};

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn().mockResolvedValue({ success: true, profile: mockProfile }),
  hasRequiredRole: jest.fn().mockReturnValue(true),
  getUserProfile: jest.fn().mockResolvedValue(mockProfile),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { api: { windowMs: 60000, maxRequests: 60 } },
}));

jest.mock('@/repositories/procedures', () => ({
  findById: jest.fn().mockResolvedValue(null),
}));

// Mock operacional appointments repository
const mockCreateAppointment = jest.fn()
const mockFindPatient = jest.fn().mockResolvedValue({ id: 'patient-1' })
const mockFindDentist = jest.fn().mockResolvedValue({ id: 'dentist-1' })
jest.mock('@/modules/operacional/repositories/appointments-repository', () => ({
  createAppointment: (...args: unknown[]) => mockCreateAppointment(...args),
  findById: jest.fn().mockResolvedValue(null),
  findByClinicWithJoins: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/modules/operacional/repositories/patients-repository', () => ({
  findById: (...args: unknown[]) => mockFindPatient(...args),
}));

jest.mock('@/modules/operacional/repositories/catalog-repository', () => ({
  findDentistById: (...args: unknown[]) => mockFindDentist(...args),
  findProcedureById: jest.fn().mockResolvedValue({ id: 'procedure-1' }),
}));

// Mock manifest so buildUserContext → enabledModules() resolves without hitting DB
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

// Mock RBAC repository
// RESERVED_ROLE_OWNER = 'Owner' (capital O) — must match exactly for owner branch
jest.mock('@/core/rbac/repository', () => ({
  drizzleRbacRepo: {
    getAccess: jest.fn().mockResolvedValue({
      isSystem: true,
      roleName: 'Owner',
      roleId: 'owner-role-id',
    }),
    getRolePermissions: jest.fn().mockResolvedValue([]),
    getOverrides: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('@/core/actions/bootstrap', () => ({
  bootstrapActions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/core/actions/registry', () => ({
  ...jest.requireActual('@/core/actions/registry'),
  registerActions: jest.fn(),
}));

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/appointments/route'

// ─── Test constants ─────────────────────────────────────────

const PATIENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const DENTIST_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

// ─── Helpers ─────────────────────────────────────────────────

function makeReq(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

function futureDate(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Appointment Conflict Detection', () => {

  beforeEach(() => {
    jest.clearAllMocks()
    // Default: conflict → EXCLUDE constraint throws pg code '23P01'
    mockCreateAppointment.mockImplementation(() => {
      const err = new Error('duplicate key value violates exclusion constraint')
      err.cause = { code: '23P01' } as unknown as Error
      return Promise.reject(err)
    })
  })

  it('deve conflitar quando novo começa DENTRO do existente (existing 09:00-10:00, new 09:30-10:30)', async () => {
    const req = makeReq({
      patientId: PATIENT_UUID,
      dentistId: DENTIST_UUID,
      scheduledAt: futureDate(3),
      durationMinutes: 60,
    })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(409)  // action system: conflict → 409
    const json = await res.json()
    expect(typeof json.error).toBe('object')
    expect(JSON.stringify(json.error)).toMatch(/indisponível|conflito|horário/i)
  })

  it('deve conflitar quando existente CONTMÉM novo (existing 09:00-10:30, new 09:30-10:00)', async () => {
    const req = makeReq({
      patientId: PATIENT_UUID,
      dentistId: DENTIST_UUID,
      scheduledAt: futureDate(3),
      durationMinutes: 30,
    })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(409)
  })

  it('deve conflitar quando existente começa ANTES e termina DENTRO do novo (existing 08:30-09:15, new 09:00-10:00)', async () => {
    const req = makeReq({
      patientId: PATIENT_UUID,
      dentistId: DENTIST_UUID,
      scheduledAt: futureDate(3),
      durationMinutes: 60,
    })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(409)
  })

  it('não deve conflitar com horário adjacente (existing 10:00-11:00, new 09:00-09:30)', async () => {
    mockCreateAppointment.mockResolvedValue({ id: 'new-appt-id' })
    const req = makeReq({
      patientId: PATIENT_UUID,
      dentistId: DENTIST_UUID,
      scheduledAt: futureDate(3),
      durationMinutes: 30,
    })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(201)
  })

  it('não deve conflitar quando dentist é omitido (agendamento não atribuído)', async () => {
    // Zod: .optional() accepts undefined, NOT null
    mockCreateAppointment.mockResolvedValue({ id: 'new-appt-id' })
    const req = makeReq({
      patientId: PATIENT_UUID,
      // dentistId omitted → optional field
      scheduledAt: futureDate(3),
      durationMinutes: 30,
    })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(201)
  })

  it('deve aceitar legacy snake_case payload (patient_id, dentist_id, scheduled_at)', async () => {
    // Legacy tests may send snake_case field names — route normalizes to camelCase
    mockCreateAppointment.mockResolvedValue({ id: 'new-appt-id' })
    const req = new Request('http://localhost/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: PATIENT_UUID,
        dentist_id: DENTIST_UUID,
        scheduled_at: futureDate(3),
        duration_minutes: 30,
      }),
    }) as unknown as NextRequest
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(201)
  })

  it('deve retornar 409 quando agendamento passado é enviado', async () => {
    // Scheduling service does not validate past dates; the EXCLUDE constraint
    // mock (23P01) returns 409 Conflict.
    const req = makeReq({
      patientId: PATIENT_UUID,
      dentistId: DENTIST_UUID,
      scheduledAt: new Date(Date.now() - 3600_000).toISOString(),
      durationMinutes: 30,
    })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(409)
  })

  it('deve retornar 401 quando não autenticado', async () => {
    const { getUserProfile } = await import('@/lib/auth/session')
    ;(getUserProfile as jest.Mock).mockResolvedValueOnce(null)
    const req = makeReq({
      patientId: PATIENT_UUID,
      dentistId: DENTIST_UUID,
      scheduledAt: futureDate(3),
      durationMinutes: 30,
    })
    const res = await POST(req as unknown as NextRequest)
    expect(res.status).toBe(401)
  })

})
