import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getAttendanceMetrics } from '@/services/analytics/attendance-metrics.service'

/**
 * GET /api/analytics/metrics
 * Get attendance metrics (message volume, intents, response time)
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
    const searchParams = new URL(request.url).searchParams

    const period = searchParams.get('period') || 'month'
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const compare = searchParams.get('compare') === 'true'

    // Calculate date range
    const endDate = new Date(dateStr)
    let startDate: Date

    switch (period) {
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'quarter':
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      case 'month':
      default:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    const metrics = await getAttendanceMetrics({
      clinicId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      compareWithPrevious: compare,
    })

    if (!metrics) {
      return apiFailure('INTERNAL_ERROR', 'Failed to fetch metrics', requestId, 500)
    }

    return apiSuccess(metrics)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
