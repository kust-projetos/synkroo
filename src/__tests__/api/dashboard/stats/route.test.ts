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

/** Modo de falha: a Nª query rejeita (simula erro de DB); 'all' rejeita todas. */
let failingSelect: number | 'all' = -1

const mockDb = {
  select: jest.fn(() => {
    const call = selectCall++
    const rows = cannedRows[call] ?? [{ count: 0 }]
    return {
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          then: (fn: any) =>
            failingSelect === 'all' || failingSelect === call
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

  // Contrato degradado VIGENTE (MAIN, com UI shipped): cada agregado que
  // falha resolve para `null` (desconhecido) em vez de zero fabricado — a rota
  // devolve 200 com `degraded: true`, `failedParts: [parte]` e flag `stale`
  // no agregado afetado (zeros com stale = "desconhecido", nunca vazio).
  // Só a falha TOTAL (6/6 agregados) é erro global 500. A UI consome
  // `failedParts` (dashboard/page.tsx) e tipa `degraded/failedParts/stale`
  // (use-queries.ts: DashboardStats) para exibir '—' nos valores degradados.
  describe('degradado em falha parcial; 500 só em falha total', () => {
    afterEach(() => { failingSelect = -1 })

    it('retorna 200 degradado quando a query de hoje falha', async () => {
      mockAuth()
      failingSelect = 0

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.degraded).toBe(true)
      expect(body.data.failedParts).toEqual(['todayAppointments'])
      expect(body.data.today.stale).toBe(true)
      // demais agregados seguem saudáveis
      expect(body.data.metrics.stale).toBe(false)
      expect(body.data.inactivePatients.stale).toBe(false)
      expect(body.error).toBeUndefined()
    })

    it('retorna 200 degradado quando a query de 30 dias falha', async () => {
      mockAuth()
      failingSelect = 1

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.degraded).toBe(true)
      expect(body.data.failedParts).toEqual(['recentAppointments'])
      expect(body.data.metrics.stale).toBe(true)
      expect(body.data.today.stale).toBe(false)
    })

    it('retorna 200 degradado quando a contagem de campanhas falha', async () => {
      mockAuth()
      failingSelect = 2

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.degraded).toBe(true)
      expect(body.data.failedParts).toEqual(['activeCampaigns'])
      expect(body.data.metrics.activeCampaigns).toBe(0)
      expect(body.data.metrics.stale).toBe(true)
    })

    it('retorna 200 degradado quando a contagem de conversas falha', async () => {
      mockAuth()
      failingSelect = 3

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.degraded).toBe(true)
      expect(body.data.failedParts).toEqual(['openConversations'])
      expect(body.data.metrics.stale).toBe(true)
    })

    it('retorna 200 degradado quando a contagem de pacientes falha', async () => {
      mockAuth()
      failingSelect = 4

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.degraded).toBe(true)
      expect(body.data.failedParts).toEqual(['totalPatients'])
      expect(body.data.metrics.totalPatients).toBe(0)
      expect(body.data.metrics.stale).toBe(true)
    })

    it('retorna 200 degradado quando getInactivityStats falha (isola em stale, não 500)', async () => {
      mockAuth()
      mockGetInactivityStats.mockRejectedValueOnce(new Error('db down'))

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.degraded).toBe(true)
      expect(body.data.failedParts).toEqual(['inactivityStats'])
      expect(body.data.inactivePatients.stale).toBe(true)
      expect(body.data.inactivePatients.totalInactive).toBe(0)
    })

    it('retorna 500 só quando TODOS os agregados falham (6/6)', async () => {
      mockAuth()
      failingSelect = 'all'
      mockGetInactivityStats.mockRejectedValueOnce(new Error('db down'))

      const res = await GET(makeReq() as any)
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_ERROR')
      expect(body.error.requestId).toEqual(expect.any(String))
      expect(body.data).toBeUndefined()
    })
  })
})
