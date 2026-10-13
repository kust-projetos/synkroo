import { NextRequest } from 'next/server'

const mockValidateApiAuth = jest.fn()
const mockGetUpcomingAppointmentRisks = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}))
jest.mock('@/services/analytics/noshow-prediction.service', () => ({
  getUpcomingAppointmentRisks: (...args: unknown[]) => mockGetUpcomingAppointmentRisks(...args),
  predictNoShowRisk: jest.fn(),
}))

import { GET } from './route'

beforeEach(() => {
  jest.clearAllMocks()
  mockValidateApiAuth.mockResolvedValue({
    success: true,
    profile: { clinic_id: 'clinic-1' },
  })
  mockGetUpcomingAppointmentRisks.mockResolvedValue([])
})

describe('GET /api/analytics/noshow-prediction', () => {
  it('returns 200 with predictions and summary (envelope canônico)', async () => {
    mockGetUpcomingAppointmentRisks.mockResolvedValue([
      { riskLevel: 'high' },
      { riskLevel: 'low' },
    ])
    const response = await GET(new NextRequest('http://localhost/api/analytics/noshow-prediction'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.predictions).toHaveLength(2)
    expect(body.data.summary).toEqual(
      expect.objectContaining({ total: 2, highRisk: 1, lowRisk: 1 }),
    )
  })

  it('propagates service DB failure as 500 (fail-closed, sem fake-success)', async () => {
    // O service rejeita em erro de DB; a rota nunca deve publicar 200
    // com predictions:[] e totais zerados.
    mockGetUpcomingAppointmentRisks.mockRejectedValue(new Error('DB error'))
    const response = await GET(new NextRequest('http://localhost/api/analytics/noshow-prediction'))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.data).toBeUndefined()
  })

  it('returns 401 envelope canônico quando não autenticado', async () => {
    mockValidateApiAuth.mockResolvedValue({
      success: false,
      error: { message: 'Unauthorized', status: 401 },
    })
    const response = await GET(new NextRequest('http://localhost/api/analytics/noshow-prediction'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(mockGetUpcomingAppointmentRisks).not.toHaveBeenCalled()
  })
})
