/**
 * GET /api/analytics/roi — contrato de erro.
 *
 * Fail-closed (P1 analytics): quando o DB falha, o serviço propaga e a rota
 * precisa devolver 500 com envelope canônico. Antes, `getROIMetrics` devolvia
 * um objeto com roi=0 e 200, indistinguível de "clínica sem atividade".
 */

const mockValidateApiAuth = jest.fn()
const mockGetROIMetrics = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}))
jest.mock('@/services/analytics/roi.service', () => ({
  getROIMetrics: (...args: unknown[]) => mockGetROIMetrics(...args),
}))

import { NextRequest } from 'next/server'
import { GET } from './route'

const okMetrics = {
  period: { start: '2026-06-01T00:00:00.000Z', end: '2026-06-30T23:59:59.999Z' },
  savings: { messagesHandled: 1, avgHandlingTimeMin: 3, hourlyRate: 25, totalSaved: 1.25 },
  revenue: { appointmentsBooked: 1, avgTicket: 350, totalRevenue: 350, recoveredNoShows: 0, recoveredRevenue: 0 },
  costs: { platform: 297, tokens: 0, total: 297 },
  roi: 18.3,
  netBenefit: 54.25,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'clinic-1' } })
  mockGetROIMetrics.mockResolvedValue(okMetrics)
})

const url = (q = '') => new NextRequest(`http://localhost/api/analytics/roi${q}`)

describe('GET /api/analytics/roi', () => {
  it('returns 200 com métricas reais', async () => {
    const res = await GET(url('?period=month&date=2026-06-01'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.roi).toBe(18.3)
    expect(mockGetROIMetrics).toHaveBeenCalledWith('clinic-1', 'month', '2026-06-01')
  })

  it('rejects invalid period antes de consultar ROI', async () => {
    const res = await GET(url('?period=week'))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_INPUT')
    expect(mockGetROIMetrics).not.toHaveBeenCalled()
  })

  it('rejects invalid date format antes de consultar ROI', async () => {
    const res = await GET(url('?date=01/06/2026'))
    expect(res.status).toBe(400)
    expect(mockGetROIMetrics).not.toHaveBeenCalled()
  })

  it('returns 401 envelope canônico quando não autenticado', async () => {
    mockValidateApiAuth.mockResolvedValue({
      success: false,
      error: { message: 'Unauthorized', status: 401 },
    })

    const res = await GET(url())
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(mockGetROIMetrics).not.toHaveBeenCalled()
  })

  it('returns 500 envelope canônico quando o cálculo de ROI falha (sem roi=0 fake)', async () => {
    mockGetROIMetrics.mockRejectedValue(new Error('db down'))

    const res = await GET(url('?period=month&date=2026-06-01'))
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.requestId).toEqual(expect.any(String))
    expect(body.data).toBeUndefined()
    expect(body.roi).toBeUndefined()
  })
})