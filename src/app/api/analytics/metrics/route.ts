import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getAttendanceMetrics } from '@/services/analytics/attendance-metrics.service'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/analytics/metrics
 * Get attendance metrics (message volume, intents, response time)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
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
      return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
    }

    return NextResponse.json(metrics)
  } catch (error) {
    return handleApiError(error)
  }
}
