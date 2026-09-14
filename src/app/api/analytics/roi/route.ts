import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getROIMetrics } from '@/services/analytics/roi.service'

/**
 * GET /api/analytics/roi
 * Get ROI metrics for the clinic
 * Query params: period (month|quarter|year), date (YYYY-MM-DD)
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
    const period = searchParams.get('period') || 'month'
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const validPeriods = ['month', 'quarter', 'year']
    if (!validPeriods.includes(period)) {
      return apiFailure('INVALID_INPUT', 'Invalid period. Use: month, quarter, or year', requestId, 400)
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return apiFailure('INVALID_INPUT', 'Invalid date format. Use YYYY-MM-DD', requestId, 400)
    }

    const roiMetrics = await getROIMetrics(clinicId, period, date)

    return apiSuccess(roiMetrics)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
