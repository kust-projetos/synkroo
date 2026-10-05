/**
 * Dashboard Stats Route Test
 *
 * Validates the shape of the response from GET /api/dashboard/stats
 * without requiring a real database connection.
 *
 * A implementação usa agregação SQL direta (count(*) + FILTER); o mock de
 * db devolve linhas agregadas enlatadas na ordem dos selects:
 * 1) hoje { total, confirmed, pending }, 2) 30 dias { total, confirmed },
 * 3) campanhas { count }, 4) conversas { count }, 5) pacientes { count }.
 */

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: jest.fn(),
}))

const cannedRows: any[][] = [
  [{ total: 10, confirmed: 4, pending: 5 }],
  [{ total: 100, confirmed: 60 }],
  [{ count: 2 }],
  [{ count: 7 }],
  [{ count: 500 }],
]
let selectCall = 0

/** Modo de falha: a Nª query rejeita (simula erro de DB). */
let failingSelect = -1

const mockDb = {
  select: jest.fn(() => {
    const call = selectCall++
    const rows = cannedRows[call] ?? [{ count: 0 }]
    return {
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          then: (fn: any) =>
            failingSelect === call
              ? Promise.reject(new Error('db down'))
              : Promise.resolve().then(() => fn(rows)),
        })),
      })),
    }
  }),
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
    ValidationError: cls,
    NotFoundError: cls,
    DatabaseError: cls,
  }
})

jest.mock('@/lib/db/schema', () => {
  const actual = jest.requireActual('@/lib/db/schema');
  return actual;
});

const mockGetInactivityStats = jest.fn()
jest.mock('@/services/followup/inactive-patient.service', () => ({
  getInactivityStats: (...args: unknown[]) => mockGetInactivityStats(...args),
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

beforeEach(() => {
  jest.clearAllMocks()
  selectCall = 0
  failingSelect = -1
  mockGetInactivityStats.mockResolvedValue({
    totalInactive: 42,
    bySegment: { '30d': 10, '60d': 15, '90d': 17 },
    atRiskRevenue: 5000,
  })
})

describe('GET /api/dashboard/stats', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuthFail()
    const res = await GET(makeReq() as any)
    expect(res.status).toBe(401)
  })

  it('returns the expected response shape with aggregated SQL data', async () => {
    mockAuth()

    const res = await GET(makeReq() as any)
    const body = await res.json()

    expect(res.status).toBe(200)
    // Envelope canônico (R2): { data: { today, metrics, inactivePatients } }
    expect(body).toHaveProperty('data')
    expect(body.data).toHaveProperty('today')
    expect(body.data).toHaveProperty('metrics')
    expect(body.data).toHaveProperty('inactivePatients')

    // today shape (agregado SQL enlatado: total 10, confirmed 4, pending 5)
    expect(body.data.today).toMatchObject({
      appointments: 10,
      confirmed: 4,
      pending: 5,
    })

    // metrics shape (confirmationRate = 60/100 = 60%)
    expect(body.data.metrics.confirmationRate).toBe(60)
    expect(body.data.metrics.activeCampaigns).toBe(2)
    expect(body.data.metrics.openConversations).toBe(7)
    expect(body.data.metrics.totalPatients).toBe(500)

    // nenhuma linha bruta: implementação não usa findByDateRange/findCampaignsByClinic
    expect(mockDb.select).toHaveBeenCalledTimes(5)

    // inactive shape
    expect(body.data.inactivePatients.totalInactive).toBe(42)
    expect(body.data.inactivePatients.bySegment).toEqual({ '30d': 10, '60d': 15, '90d': 17 })
  })

  // Fail-closed (P1 analytics): erro de DB no dashboard precisa virar 500 com
  // envelope canônico — nunca 200 com contagens zeradas (falso "clínica sadia").
  describe('fail-closed em erro de DB', () => {
    afterEach(() => { failingSelect = -1 })

    it('retorna 500 quando a query de hoje falha', async () => {
      mockAuth()
      failingSelect = 0

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_ERROR')
      expect(body.error.requestId).toEqual(expect.any(String))
      expect(body.data).toBeUndefined()
    })

    it('retorna 500 quando a query de 30 dias falha', async () => {
      mockAuth()
      failingSelect = 1

      const res = await GET(makeReq() as any)
      expect(res.status).toBe(500)
      expect((await res.json()).error.code).toBe('INTERNAL_ERROR')
    })

    it('retorna 500 quando a contagem de campanhas falha', async () => {
      mockAuth()
      failingSelect = 2

      const res = await GET(makeReq() as any)
      expect(res.status).toBe(500)
    })

    it('retorna 500 quando a contagem de conversas falha', async () => {
      mockAuth()
      failingSelect = 3

      const res = await GET(makeReq() as any)
      expect(res.status).toBe(500)
    })

    it('retorna 500 quando a contagem de pacientes falha', async () => {
      mockAuth()
      failingSelect = 4

      const res = await GET(makeReq() as any)
      expect(res.status).toBe(500)
    })

    it('retorna 500 quando getInactivityStats falha (não isola mais em zero)', async () => {
      mockAuth()
      mockGetInactivityStats.mockRejectedValueOnce(new Error('db down'))

      const res = await GET(makeReq() as any)
      expect(res.status).toBe(500)
      expect((await res.json()).error.code).toBe('INTERNAL_ERROR')
    })
  })
})
