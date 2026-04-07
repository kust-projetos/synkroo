import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { dbLogger } from '@/lib/logger'
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
    dbLogger.error('Error fetching analytics insights', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}