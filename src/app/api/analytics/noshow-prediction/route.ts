import { NextRequest } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { predictNoShowRisk, getUpcomingAppointmentRisks } from '@/services/analytics/noshow-prediction.service'

// Etapa 2.5 (SYN-API-003): todo input externo passa por validação de runtime.
// O POST chamava o service direto com checagem manual (`if (!patientId...)`)
// sem schema — sem enforcement de tipo/formato e com 500 em JSON malformado.
const noshowPredictionBodySchema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.string().min(1),
  procedureId: z.string().uuid().optional(),
})

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
    const rawDays = parseInt(searchParams.get('days') || '7', 10)
    // Etapa 2.5: query param sem schema — NaN/negativo ia parar no service.
    // Normaliza para inteiro positivo com teto antes da chamada.
    const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 90) : 7

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

    const rawBody = await request.json().catch(() => null)
    const parsed = noshowPredictionBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      return apiFailure(
        'INVALID_INPUT',
        'patientId (uuid) and scheduledAt are required',
        requestId,
        400,
      )
    }
    const { patientId, scheduledAt, procedureId } = parsed.data

    const prediction = await predictNoShowRisk(patientId, scheduledAt, procedureId)

    return apiSuccess(prediction)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
