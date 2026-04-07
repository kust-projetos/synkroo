import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { predictNoShowRisk, getUpcomingAppointmentRisks } from '@/services/analytics/noshow-prediction.service'

/**
 * GET /api/analytics/noshow-prediction
 * Get no-show risk predictions for upcoming appointments
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
    const days = parseInt(searchParams.get('days') || '7')

    const predictions = await getUpcomingAppointmentRisks(clinicId, days)

    return NextResponse.json({
      predictions,
      summary: {
        total: predictions.length,
        highRisk: predictions.filter((p) => p.riskLevel === 'high').length,
        mediumRisk: predictions.filter((p) => p.riskLevel === 'medium').length,
        lowRisk: predictions.filter((p) => p.riskLevel === 'low').length,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/analytics/noshow-prediction
 * Predict no-show risk for a specific appointment
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const body = await request.json()
    const { patientId, scheduledAt, procedureId } = body

    if (!patientId || !scheduledAt) {
      return NextResponse.json(
        { error: 'patientId and scheduledAt are required' },
        { status: 400 }
      )
    }

    const prediction = await predictNoShowRisk(patientId, scheduledAt, procedureId)

    return NextResponse.json(prediction)
  } catch (error) {
    return handleApiError(error)
  }
}