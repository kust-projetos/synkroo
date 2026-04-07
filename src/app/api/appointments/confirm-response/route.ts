import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { processConfirmationResponse } from '@/services/appointments/confirmation-handler.service'
import { handleApiError, ValidationError } from '@/lib/errors'

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
      return handleApiError(new ValidationError('Missing required fields: clinicId, patientPhone, message'))
    }

    const result = await processConfirmationResponse(clinicId, patientPhone, message)

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}
