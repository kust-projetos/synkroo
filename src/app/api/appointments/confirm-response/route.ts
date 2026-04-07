import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { processConfirmationResponse } from '@/services/appointments/confirmation-handler.service'

/**
 * POST /api/appointments/confirm-response
 * Process a patient's confirmation/cancellation response via WhatsApp
 * Body: { clinicId, patientPhone, message }
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
    const { clinicId, patientPhone, message } = body as {
      clinicId?: string
      patientPhone?: string
      message?: string
    }

    if (!clinicId || !patientPhone || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: clinicId, patientPhone, message' },
        { status: 400 }
      )
    }

    const result = await processConfirmationResponse(clinicId, patientPhone, message)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing confirmation response:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
