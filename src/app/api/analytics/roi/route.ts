import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError, ValidationError } from '@/lib/errors'
import { getROIMetrics } from '@/services/analytics/roi.service'

/**
 * GET /api/analytics/roi
 * Get ROI metrics for the clinic
 * Query params: period (month|quarter|year), date (YYYY-MM-DD)
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
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    const validPeriods = ['month', 'quarter', 'year']
    if (!validPeriods.includes(period)) {
      return handleApiError(new ValidationError('Invalid period. Use: month, quarter, or year'))
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(date)) {
      return handleApiError(new ValidationError('Invalid date format. Use YYYY-MM-DD'))
    }

    const roiMetrics = await getROIMetrics(clinicId, period, date)

    return NextResponse.json(roiMetrics)
  } catch (error) {
    return handleApiError(error)
  }
}
