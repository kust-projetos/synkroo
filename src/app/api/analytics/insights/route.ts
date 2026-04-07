import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { getClinicInsights } from '@/services/analytics/analytics.service'

/**
 * GET /api/analytics/insights
 * Get comprehensive clinic analytics
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
    const trendDays = parseInt(searchParams.get('trend_days') || '30')
    const forecastDays = parseInt(searchParams.get('forecast_days') || '14')

    const insights = await getClinicInsights(clinicId, { trendDays, forecastDays })

    return NextResponse.json(insights)
  } catch (error) {
    return handleApiError(error)
  }
}