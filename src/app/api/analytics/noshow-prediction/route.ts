import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { predictNoShowRisk, getUpcomingAppointmentRisks } from '@/services/analytics/noshow-prediction.service'

/**
 * GET /api/analytics/noshow-prediction
 * Get no-show risk predictions for upcoming appointments
 *
 * Sem módulo correspondente (analytics é transversal): mantém validateApiAuth
 * + envelope canônico mínimo, sem gate withModuleRoute. Justificativa D2.
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')

    const predictions = await getUpcomingAppointmentRisks(clinicId, days)

    return apiSuccess({
      predictions,
      summary: {
        total: predictions.length,
        highRisk: predictions.filter((p) => p.riskLevel === 'high').length,
        mediumRisk: predictions.filter((p) => p.riskLevel === 'medium').length,
        lowRisk: predictions.filter((p) => p.riskLevel === 'low').length,
      },
    })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * POST /api/analytics/noshow-prediction
 * Predict no-show risk for a specific appointment
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const body = await request.json()
    const { patientId, scheduledAt, procedureId } = body

    if (!patientId || !scheduledAt) {
      return apiFailure(
        'INVALID_INPUT',
        'patientId and scheduledAt are required',
        requestId,
        400,
      )
    }

    const prediction = await predictNoShowRisk(patientId, scheduledAt, procedureId)

    return apiSuccess(prediction)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
