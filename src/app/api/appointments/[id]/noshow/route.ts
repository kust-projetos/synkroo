import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { markNoShow } from '@/services/appointments/appointment-actions.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/appointments/[id]/noshow
 * Mark an appointment as no-show
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Appointment ID is required' }, { status: 400 })
    }

    // Verify appointment belongs to user's clinic
    const supabase = await createTypedClient()
    const { data: appointment } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (!appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 })
    }

    const result = await markNoShow(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}