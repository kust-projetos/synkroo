import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getClinicInsights } from '@/services/analytics/analytics.service'

/**
 * GET /api/analytics/insights
 * Get comprehensive clinic analytics
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
    const trendDays = parseInt(searchParams.get('trend_days') || '30')
    const forecastDays = parseInt(searchParams.get('forecast_days') || '14')
    if (!Number.isInteger(trendDays) || trendDays < 1 || trendDays > 365 ||
      !Number.isInteger(forecastDays) || forecastDays < 1 || forecastDays > 90) {
      return apiFailure('INVALID_INPUT', 'Invalid analytics period', requestId, 400)
    }

    const insights = await getClinicInsights(clinicId, { trendDays, forecastDays })

    return apiSuccess({ ...insights, period: { trendDays, forecastDays } })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
