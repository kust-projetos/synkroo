/** Tests for pipeline/analytics route */
const mockValidateApiAuth = jest.fn()
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: mockValidateApiAuth }))
jest.mock('@/services/pipeline/pipeline-analytics.service', () => ({ getConversionByStage: jest.fn(), getAvgConversionTime: jest.fn() }))
jest.mock('@/services/reports/financial-reports.service', () => ({ getInactivePatients: jest.fn(), getUpsellOpportunities: jest.fn() }))
const { getConversionByStage, getAvgConversionTime } = require('@/services/pipeline/pipeline-analytics.service')
const { getInactivePatients, getUpsellOpportunities } = require('@/services/reports/financial-reports.service')

const authOk = () => mockValidateApiAuth.mockResolvedValue({ success: true, profile: { clinic_id: 'c1' } })
const authFail = () => mockValidateApiAuth.mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } })

import { NextRequest } from 'next/server'
import { GET } from '../../../../app/api/pipeline/analytics/route'

beforeEach(() => { jest.clearAllMocks() })

describe('pipeline/analytics', () => {
  it('returns 401', async () => { authFail(); const r = await GET(new NextRequest('http://localhost')); expect(r.status).toBe(401) })
  it('returns 400 for invalid action', async () => { authOk(); const r = await GET(new NextRequest('http://localhost')); expect(r.status).toBe(400) })
  it('returns conversion_by_stage', async () => { authOk(); getConversionByStage.mockResolvedValue([{ stageId: 's1', stageName: 'Novo' }]); const r = await GET(new NextRequest('http://localhost?action=conversion_by_stage')); const b = await r.json(); expect(b.stages).toHaveLength(1) })
  it('returns avg_conversion_time', async () => { authOk(); getAvgConversionTime.mockResolvedValue(5.5); const r = await GET(new NextRequest('http://localhost?action=avg_conversion_time')); const b = await r.json(); expect(b.avgDays).toBe(5.5) })
  it('returns inactive_patients', async () => { authOk(); getInactivePatients.mockResolvedValue([{ id: 'p1' }]); const r = await GET(new NextRequest('http://localhost?action=inactive_patients')); const b = await r.json(); expect(b.patients).toHaveLength(1) })
  it('returns upsell_opportunities', async () => { authOk(); getUpsellOpportunities.mockResolvedValue([{ id: 'b1' }]); const r = await GET(new NextRequest('http://localhost?action=upsell_opportunities')); const b = await r.json(); expect(b.opportunities).toHaveLength(1) })
})
