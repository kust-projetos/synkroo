/**
 * Route test — POST /api/analytics/noshow-prediction
 *
 * P0 trust fixes:
 * 1. tenant scope: clinicId sempre do contexto autenticado (nunca do body);
 * 2. 404 opaco para paciente inexistente/de outra clínica (sem PHI leak);
 * 3. 500 fail-closed quando o service falha (sem score fabricado).
 */
import { NextRequest } from 'next/server'

const mockValidateApiAuth = jest.fn()
const mockPredictNoShowRisk = jest.fn()
const mockGetUpcomingAppointmentRisks = jest.fn()

jest.mock('@/lib/auth/session', () => ({
  validateApiAuth: (...args: unknown[]) => mockValidateApiAuth(...args),
}))

jest.mock('@/services/analytics/noshow-prediction.service', () => ({
  predictNoShowRisk: (...args: unknown[]) => mockPredictNoShowRisk(...args),
  getUpcomingAppointmentRisks: (...args: unknown[]) => mockGetUpcomingAppointmentRisks(...args),
}))

import { POST } from '@/app/api/analytics/noshow-prediction/route'

function makeReq(body: unknown): NextRequest {
  return new Request('http://localhost/api/analytics/noshow-prediction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest
}

const authOk = {
  success: true as const,
  profile: { id: 'user-1', clinic_id: 'clinic-A' },
}

const validBody = {
  patientId: '11111111-1111-1111-1111-111111111111',
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
}

describe('POST /api/analytics/noshow-prediction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockValidateApiAuth.mockResolvedValue(authOk)
  })

  it('retorna 401 quando não autenticado', async () => {
    mockValidateApiAuth.mockResolvedValueOnce({ success: false, error: 'Unauthorized' })

    const res = await POST(makeReq(validBody))

    expect(res.status).toBe(401)
    expect(mockPredictNoShowRisk).not.toHaveBeenCalled()
  })

  it('retorna 400 para body inválido (patientId não-uuid)', async () => {
    const res = await POST(makeReq({ patientId: 'not-a-uuid', scheduledAt: '2026-10-10' }))

    expect(res.status).toBe(400)
    expect(mockPredictNoShowRisk).not.toHaveBeenCalled()
  })

  it('propaga clinicId do contexto autenticado (nunca aceita clinicId do body)', async () => {
    mockPredictNoShowRisk.mockResolvedValueOnce({
      patient_id: validBody.patientId,
      patient_name: 'João',
      scheduled_at: validBody.scheduledAt,
      risk_score: 10,
      riskLevel: 'low',
      factors: [],
      recommendations: [],
    })

    const res = await POST(makeReq({ ...validBody, clinicId: 'clinic-B' }))

    expect(res.status).toBe(200)
    // clinicId derivado do auth (clinic-A), não do payload (clinic-B)
    expect(mockPredictNoShowRisk).toHaveBeenCalledWith('clinic-A', validBody.patientId, validBody.scheduledAt, undefined)
  })

  it('retorna 404 opaco quando paciente não pertence à clínica (anti-IDOR)', async () => {
    mockPredictNoShowRisk.mockResolvedValueOnce(null)

    const res = await POST(makeReq(validBody))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('PATIENT_NOT_FOUND')
    // 404 opaco: sem dados do paciente no corpo
    expect(JSON.stringify(body)).not.toContain('patient_name')
  })

  it('retorna 500 quando o service falha (fail-closed, sem score fabricado)', async () => {
    mockPredictNoShowRisk.mockRejectedValueOnce(new Error('db down'))

    const res = await POST(makeReq(validBody))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(body)).not.toContain('risk_score')
  })
})
