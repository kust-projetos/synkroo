/**
 * Appointment Conflict Detection Tests
 *
 * Tests the interval-overlap logic in POST /api/appointments.
 * Correct overlap definition: existing.start < new.end AND existing.end > new.start
 */

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  returning: jest.fn().mockReturnThis(),
};

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mockDb),
}));

const mockProfile = {
  id: 'test-user-id', email: 'test@example.com', name: 'Test User',
  role: 'owner' as const, phone: null, avatarUrl: null, isActive: true,
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

jest.mock('@/repositories/procedures', () => ({
  findById: jest.fn().mockResolvedValue(null),
}));

// ─── Repo mocks (direct — avoids brittle db-chain mocking) ────

const mockCreate = jest.fn()
const mockFindByIdWithJoins = jest.fn()

jest.mock('@/repositories/appointments', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
  findByIdWithJoins: (...args: unknown[]) => mockFindByIdWithJoins(...args),
}))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/appointments/route'

// ─── Test constants ─────────────────────────────────────────

const PATIENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const DENTIST_UUID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const CLINIC_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

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

/** Simulate conflict query result — must be called BEFORE POST() in each test */
function mockConflictResult(rows: unknown[]) {
  mockDb.where.mockReturnValueOnce({
    limit: jest.fn().mockResolvedValue(rows),
  })
}

function resetAll() {
  jest.clearAllMocks()
  // Default: where returns mockDb (chainable — used by non-conflict queries)
  mockDb.where.mockReturnValue(mockDb)
  mockDb.select.mockReturnValue(mockDb)
  mockDb.from.mockReturnValue(mockDb)
  mockDb.limit.mockReturnValue(mockDb)
  mockDb.insert.mockReturnValue(mockDb)
  mockDb.values.mockReturnValue(mockDb)
  mockDb.returning.mockReturnValue(mockDb)
  mockCreate.mockReset()
  mockFindByIdWithJoins.mockReset()
}

type AppointmentWithJoins = Awaited<ReturnType<typeof import('@/repositories/appointments').findByIdWithJoins>>
type AppointmentRow = NonNullable<AppointmentWithJoins>

function makeAppt(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: 'apt-created',
    clinicId: CLINIC_UUID,
    patientId: PATIENT_UUID,
    dentistId: 'dentist-001',
    procedureId: null,
    scheduledAt: new Date(),
    durationMinutes: 30,
    status: 'scheduled',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    patient: { id: PATIENT_UUID, name: 'Test Patient', phone: '11999990001', email: null },
    dentist: { id: DENTIST_UUID, name: 'Dr. Silva', phone: null, specialty: 'ortodontia' },
    procedure: null,
    ...overrides,
  } as AppointmentRow
}

// ─── Tests ──────────────────────────────────────────────────

describe('Appointment Conflict Detection', () => {
  beforeEach(() => resetAll())

  // ── Overlap → must return 400 ────────────────────────────

  it('deve conflitar quando novo começa DENTRO do existente (existing 09:00-10:00, new 09:30-10:30)', async () => {
    mockConflictResult([{ id: 'existing-001' }])

    const req = makeReq({
      patient_id: PATIENT_UUID,
      dentist_id: DENTIST_UUID,
      scheduled_at: futureDate(2),
      duration_minutes: 60,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/indisponível|conflito|horário/i)
  })

  it('deve conflitar quando existente CONTMÉM novo (existing 09:00-10:30, new 09:30-10:00)', async () => {
    mockConflictResult([{ id: 'existing-002' }])

    const req = makeReq({
      patient_id: PATIENT_UUID,
      dentist_id: DENTIST_UUID,
      scheduled_at: futureDate(2),
      duration_minutes: 30,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('deve conflitar quando existente começa ANTES e termina DENTRO do novo (existing 08:30-09:15, new 09:00-10:00)', async () => {
    mockConflictResult([{ id: 'existing-003' }])

    const req = makeReq({
      patient_id: PATIENT_UUID,
      dentist_id: DENTIST_UUID,
      scheduled_at: futureDate(1.5),
      duration_minutes: 60,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  // ── No overlap → must return 201 ─────────────────────────

  it('não deve conflitar com horário adjacente (existing 10:00-11:00, new 09:00-09:30)', async () => {
    mockConflictResult([]) // no conflicts
    mockCreate.mockResolvedValueOnce({ id: 'new-apt', clinicId: CLINIC_UUID, patientId: PATIENT_UUID, dentistId: DENTIST_UUID })
    mockFindByIdWithJoins.mockResolvedValueOnce(makeAppt({ id: 'new-apt' }))

    const req = makeReq({
      patient_id: PATIENT_UUID,
      dentist_id: DENTIST_UUID,
      scheduled_at: futureDate(1),
      duration_minutes: 30,
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('não deve conflitar quando dentist_id é null (agendamento não atribuído)', async () => {
    mockConflictResult([]) // no conflicts (no dentist filter when null)
    mockCreate.mockResolvedValueOnce({ id: 'new-apt-unassigned', clinicId: CLINIC_UUID, patientId: PATIENT_UUID, dentistId: null })
    mockFindByIdWithJoins.mockResolvedValueOnce(makeAppt({ id: 'new-apt-unassigned', dentistId: null, dentist: null }))

    const req = makeReq({
      patient_id: PATIENT_UUID,
      dentist_id: null,
      scheduled_at: futureDate(2),
      duration_minutes: 30,
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  // ── Edge cases ─────────────────────────────────────────────

  it('deve retornar 400 quando agendamento passado é enviado', async () => {
    const req = makeReq({
      patient_id: PATIENT_UUID,
      dentist_id: DENTIST_UUID,
      scheduled_at: '2020-01-01T09:00:00Z',
      duration_minutes: 30,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('deve retornar 401 quando não autenticado', async () => {
    jest.resetModules()
    jest.doMock('@/lib/auth/session', () => ({
      validateApiAuth: jest.fn().mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } }),
    }))
    const { POST: AuthPOST } = await import('@/app/api/appointments/route')
    const req = makeReq({ patient_id: PATIENT_UUID, dentist_id: DENTIST_UUID, scheduled_at: futureDate(2), duration_minutes: 30 })
    const res = await AuthPOST(req)
    expect(res.status).toBe(401)
  })
})