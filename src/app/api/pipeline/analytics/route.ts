/**
 * Pipeline Analytics API Route
 *
 * GET /api/pipeline/analytics
 *
 * Provides pipeline analytics data:
 * - conversion_by_stage: Lead conversion rates by pipeline stage
 * - avg_conversion_time: Average lead-to-patient conversion time in days
 * - inactive_patients: Patients with no visits in 90+ days
 * - upsell_opportunities: Completed treatments without active follow-up budget
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getConversionByStage, getAvgConversionTime } from '@/services/pipeline/pipeline-analytics.service'
import { getInactivePatients, getUpsellOpportunities } from '@/services/reports/financial-reports.service'

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error?.message || 'Unauthorized' },
        { status: authResult.error?.status || 401 }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'conversion_by_stage': {
        const conversionData = await getConversionByStage(clinicId)
        return NextResponse.json({ stages: conversionData })
      }

      case 'avg_conversion_time': {
        const avgTime = await getAvgConversionTime(clinicId)
        return NextResponse.json({ avgDays: avgTime })
      }

      case 'inactive_patients': {
        const inactive = await getInactivePatients(clinicId)
        return NextResponse.json({ patients: inactive })
      }

      case 'upsell_opportunities': {
        const upsell = await getUpsellOpportunities(clinicId)
        return NextResponse.json({ opportunities: upsell })
      }

      default:
        return NextResponse.json(
          {
            error: 'Invalid action. Use: conversion_by_stage, avg_conversion_time, inactive_patients, upsell_opportunities'
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Pipeline analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
