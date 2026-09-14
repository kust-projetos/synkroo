import { NextRequest } from 'next/server'

const mockValidateApiAuth = jest.fn()
const mockGetClinicInsights = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}))
jest.mock('@/services/analytics/analytics.service', () => ({
  getClinicInsights: (...args: unknown[]) => mockGetClinicInsights(...args),
}))

import { GET } from './route'

beforeEach(() => {
  jest.clearAllMocks()
  mockValidateApiAuth.mockResolvedValue({
    success: true,
    profile: { clinic_id: 'clinic-1' },
  })
  mockGetClinicInsights.mockResolvedValue({
    appointmentTrends: [],
    hourlyDistribution: [],
    dayOfWeekDistribution: [],
    highRiskPatients: [],
    demandForecast: [],
    metrics: {},
  })
})

describe('GET /api/analytics/insights', () => {
  it('returns explicit period metadata (envelope canônico)', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/analytics/insights?trend_days=30&forecast_days=14',
    ))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.period).toEqual(expect.objectContaining({ trendDays: 30, forecastDays: 14 }))
  })

  it('rejects invalid period lengths before querying analytics (envelope canônico)', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/analytics/insights?trend_days=0',
    ))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('INVALID_INPUT')
    expect(mockGetClinicInsights).not.toHaveBeenCalled()
  })

  it('returns 401 envelope canônico quando não autenticado', async () => {
    mockValidateApiAuth.mockResolvedValue({
      success: false,
      error: { message: 'Unauthorized', status: 401 },
    })
    const response = await GET(new NextRequest('http://localhost/api/analytics/insights'))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(mockGetClinicInsights).not.toHaveBeenCalled()
  })
})
