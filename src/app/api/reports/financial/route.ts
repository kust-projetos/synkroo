/**
 * Financial Reports API Route
 *
 * GET /api/reports/financial
 *
 * Query params:
 *   period: 'month' | 'quarter' | 'year' (required)
 *   date: YYYY-MM-DD (optional, defaults to today)
 *
 * Returns financial report with:
 *   - revenue: Sum of accepted budgets in period
 *   - payments: Sum of payments received in period
 *   - outstanding: revenue - payments
 *   - byProcedure: Breakdown by procedure
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getFinancialReport, type PeriodType } from '@/services/reports/financial-reports.service'

const VALID_PERIODS: PeriodType[] = ['month', 'quarter', 'year']

export async function GET(request: NextRequest) {
  try {
    // Validate authentication + authorization (financeiro:view)
    const authResult = await validateApiAuth('financeiro:view')
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error?.message || 'Unauthorized' },
        { status: authResult.error?.status || 401 }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const periodParam = searchParams.get('period')
    const dateParam = searchParams.get('date')

    // Validate period parameter
    if (!periodParam) {
      return NextResponse.json(
        { error: 'Missing required parameter: period' },
        { status: 400 }
      )
    }

    if (!VALID_PERIODS.includes(periodParam as PeriodType)) {
      return NextResponse.json(
        { error: 'Invalid period. Use: month, quarter, or year' },
        { status: 400 }
      )
    }

    // Parse date or default to today
    const date = dateParam ? new Date(dateParam) : new Date()

    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const period = periodParam as PeriodType
    const report = await getFinancialReport(clinicId, period, date)

    return NextResponse.json(report)
  } catch (error) {
    console.error('Financial report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
