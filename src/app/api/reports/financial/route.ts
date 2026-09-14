/**
 * Financial Reports API Route — contrato canônico (D2 lote 5/5).
 *
 * GET /api/reports/financial
 *
 * Query params:
 *   period: 'month' | 'quarter' | 'year' (required)
 *   date: YYYY-MM-DD (optional, defaults to today)
 *
 * Resposta canônica: { data: <financial report> }
 */

import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import { getFinancialReport, type PeriodType } from '@/services/reports/financial-reports.service'

const VALID_PERIODS: PeriodType[] = ['month', 'quarter', 'year']

async function handleGET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    // Validate authentication + authorization (financeiro:view)
    const authResult = await validateApiAuth('financeiro:view')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const periodParam = searchParams.get('period')
    const dateParam = searchParams.get('date')

    // Validate period parameter
    if (!periodParam) {
      return apiFailure('INVALID_INPUT', 'Missing required parameter: period', requestId, 400)
    }

    if (!VALID_PERIODS.includes(periodParam as PeriodType)) {
      return apiFailure('INVALID_INPUT', 'Invalid period. Use: month, quarter, or year', requestId, 400)
    }

    // Parse date or default to today
    const date = dateParam ? new Date(dateParam) : new Date()

    if (isNaN(date.getTime())) {
      return apiFailure('INVALID_INPUT', 'Invalid date format. Use YYYY-MM-DD', requestId, 400)
    }

    const period = periodParam as PeriodType
    const report = await getFinancialReport(clinicId, period, date)

    return apiSuccess(report)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const GET = withModuleRoute('financeiro')(handleGET)
