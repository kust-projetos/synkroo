/**
 * Dashboard Stats Route Test
 *
 * Validates the shape of the response from GET /api/dashboard/stats
 * without requiring a real database connection.
 *
 * Mock pattern: factory uses jest.requireActual to avoid hoisting issues.
 */

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
}))

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  then: jest.fn((fn: any) => Promise.resolve(fn([{ count: 500 }]))),
}

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mockDb),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/errors', () => {
  const cls = class extends Error {
    status: number
    constructor(msg: string, status = 400) { super(msg); this.status = status }
  }
  return {
    handleApiError: jest.fn((err) => {
      const msg = (err instanceof Error) ? err.message : String(err)
      const json = async () => ({ error: msg })
      return { status: 500, json } as any
    }),
    ValidationError: cls,
    NotFoundError: cls,
    DatabaseError: cls,
  }
})

// Mock repositories
// Mock repositories — always return simple data regardless of params
jest.mock('@/repositories/appointments', () => ({
  findByDateRange: jest.fn().mockResolvedValue([
    { status: 'scheduled' },
    { status: 'confirmed' },
    { status: 'completed' },
  ]),
}))

jest.mock('@/repositories/campaigns', () => ({
  findCampaignsByClinic: jest.fn().mockResolvedValue([
    { id: 'c1', status: 'running' },
  ]),
}))

jest.mock('@/lib/db/schema', () => {
  const actual = jest.requireActual('@/lib/db/schema');
  return actual;
});

jest.mock('@/services/followup/inactive-patient.service', () => ({
  getInactivityStats: jest.fn().mockResolvedValue({
    totalInactive: 42,
    bySegment: { '30d': 10, '60d': 15, '90d': 17 },
    atRiskRevenue: 5000,
  }),
}))

import { GET } from '@/app/api/dashboard/stats/route'
import { validateApiAuth } from '@/lib/auth/session'

function mockAuth(profile: any = { id: 'u1', clinic_id: 'c1', email: 'a@b.com', role: 'owner' }) {
  ;(validateApiAuth as jest.Mock).mockResolvedValue({ success: true, profile })
}

function mockAuthFail() {
  ;(validateApiAuth as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
}

function makeReq(): Request {
  return new Request('http://localhost:3000/api/dashboard/stats')
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/dashboard/stats', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuthFail()
    const res = await GET(makeReq() as any)
    expect(res.status).toBe(401)
  })

  it('returns the expected response shape with live mock data', async () => {
    mockAuth()

    // Repositories already return default data via jest.mock above.
    // No need to override per-test unless testing specific edge cases.

    const res = await GET(makeReq() as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('today')
    expect(body).toHaveProperty('metrics')
    expect(body).toHaveProperty('inactivePatients')

    // today shape (3 appointments from mock)
    expect(body.today).toMatchObject({
      appointments: 3,
      confirmed: 1,
      pending: 1,
    })

    // metrics shape
    expect(body.metrics.confirmationRate).toBeGreaterThanOrEqual(0)
    expect(body.metrics.activeCampaigns).toBe(1) // 1 running from mock
    expect(typeof body.metrics.totalPatients).toBe('number')
    expect(typeof body.metrics.openConversations).toBe('number')

    // inactive shape
    expect(body.inactivePatients.totalInactive).toBe(42)
    expect(body.inactivePatients.bySegment).toEqual({ '30d': 10, '60d': 15, '90d': 17 })
  })
})
