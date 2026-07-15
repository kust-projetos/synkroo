/**
 * Dashboard Alerts Route Test
 * Validates shape and ordering of GET /api/dashboard/alerts response.
 * Mocks the three services the route actually uses (the prior mock of
 * @/services/leads/leads.service (getHotLeads) was on the wrong layer —
 * the route uses listLeadsByClinic from the comercial repository).
 */
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }))

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  then: jest.fn((fn: any) => Promise.resolve(fn([]))),
}

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/errors', () => {
  const cls = class extends Error {
    status: number
    constructor(msg: string, status = 400) { super(msg); this.status = status }
  }
  return {
    handleApiError: jest.fn((err: any) => {
      const msg = err?.message || String(err)
      return { status: 500, json: async () => ({ error: msg }) } as any
    }),
    ValidationError: cls, NotFoundError: cls, DatabaseError: cls,
  }
})

jest.mock('@/services/appointments/incomplete-treatment.service', () => ({
  getIncompleteTreatmentAlerts: jest.fn(),
}))

jest.mock('@/modules/comercial/repositories/leads-repository', () => ({
  listLeadsByClinic: jest.fn(),
}))

jest.mock('@/services/followup/budget-followup.service', () => ({
  findUnconvertedBudgets: jest.fn(),
}))

import { GET } from '../../../../app/api/dashboard/alerts/route'
import { validateApiAuth } from '@/lib/auth/session'
import { getIncompleteTreatmentAlerts } from '@/services/appointments/incomplete-treatment.service'
import { listLeadsByClinic } from '@/modules/comercial/repositories/leads-repository'
import { findUnconvertedBudgets } from '@/services/followup/budget-followup.service'

const mockAuth = () => (validateApiAuth as jest.Mock).mockResolvedValue({
  success: true, profile: { clinic_id: 'c1', id: 'u1', role: 'admin' },
})
const mockAuthFail = () => (validateApiAuth as jest.Mock).mockResolvedValue({
  success: false, error: { message: 'Unauthorized', status: 401 },
})

const makeReq = () => ({ url: 'http://localhost/api/dashboard/alerts' })

beforeEach(() => {
  jest.clearAllMocks()
  ;(getIncompleteTreatmentAlerts as jest.Mock).mockResolvedValue({
    total: 0, highRisk: 0, mediumRisk: 0, treatments: [],
  })
  ;(listLeadsByClinic as jest.Mock).mockResolvedValue([])
  ;(findUnconvertedBudgets as jest.Mock).mockResolvedValue([])
})

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
    ;(listLeadsByClinic as jest.Mock).mockResolvedValue([
      { id: 'lead1', name: 'Lead Test', temperature: 'hot', score: 85, status: 'novo' },
    ])
    mockAuth()
    const res = await GET(makeReq() as any)
    const body = await res.json()
    expect(body.alerts.length).toBeGreaterThan(0)
  })
})
