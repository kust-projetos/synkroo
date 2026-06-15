/**
 * Dashboard Alerts Route Test
 * Validates shape of GET /api/dashboard/alerts response
 * without requiring a real database connection.
 */

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }))

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  then: jest.fn((fn: any) => Promise.resolve(fn([]))),
}
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/errors', () => {
  const cls = class extends Error { status: number
    constructor(msg: string, status = 400) { super(msg); this.status = status } }
  return {
    handleApiError: jest.fn((err: any) => {
      const msg = err?.message || String(err)
      return { status: 500, json: async () => ({ error: msg }) } as any
    }),
    ValidationError: cls, NotFoundError: cls, DatabaseError: cls,
  }
})

jest.mock('@/services/leads/leads.service', () => ({
  getHotLeads: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/services/appointments/incomplete-treatment.service', () => ({
  getIncompleteTreatmentAlerts: jest.fn().mockResolvedValue({
    total: 0, highRisk: 0, mediumRisk: 0, treatments: [],
  }),
}))

jest.mock('@/services/followup/budget-followup.service', () => ({
  findUnconvertedBudgets: jest.fn().mockResolvedValue([]),
}))

import { GET } from '@/app/api/dashboard/alerts/route'
import { validateApiAuth } from '@/lib/auth/session'

function mockAuth(profile: any = { id: 'u1', clinic_id: 'c1', role: 'owner' }) {
  ;(validateApiAuth as jest.Mock).mockResolvedValue({ success: true, profile })
}
function mockAuthFail() {
  ;(validateApiAuth as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })
}
function makeReq(): Request { return new Request('http://localhost:3000/api/dashboard/alerts') }

beforeEach(() => jest.clearAllMocks())

describe('GET /api/dashboard/alerts', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuthFail()
    const res = await GET(makeReq() as any)
    expect(res.status).toBe(401)
  })

  it('returns the expected response shape { alerts, stats }', async () => {
    mockAuth()
    const res = await GET(makeReq() as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveProperty('alerts')
    expect(body).toHaveProperty('stats')
    expect(Array.isArray(body.alerts)).toBe(true)
    expect(body.stats).toHaveProperty('totalAlerts')
    expect(body.stats).toHaveProperty('highPriority')
    expect(body.stats).toHaveProperty('todayAppointments')
    expect(body.stats).toHaveProperty('confirmedToday')
    expect(body.stats).toHaveProperty('confirmationRate')
    expect(body.stats).toHaveProperty('messagesThisWeek')
    expect(body.stats).toHaveProperty('messageChangePercent')
  })

  it('orders alerts by priority (high before medium)', async () => {
    const { getHotLeads } = require('@/services/leads/leads.service')
    getHotLeads.mockResolvedValue([{
      id: 'lead1', name: 'Lead Test', score: 85, interest: 'implante',
      updated_at: new Date().toISOString(),
    }])

    mockAuth()
    const res = await GET(makeReq() as any)
    const body = await res.json()

    // Hot leads are 'high' priority and should appear
    expect(body.alerts.length).toBeGreaterThan(0)
    const priorities = body.alerts.map((a: any) => a.priority)
    // All high should come before medium/low
    const firstMedium = priorities.indexOf('medium')
    if (firstMedium > 0) {
      expect(priorities.slice(0, firstMedium).every((p: string) => p === 'high')).toBe(true)
    }
  })
})
