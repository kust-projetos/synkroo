import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { handleApiError } from '@/lib/errors'
import { getPatientHistory } from '@/services/patients/patient-history.service'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patients/[id]/history
 * Get complete patient attendance history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 })
    }

    // Verify patient belongs to user's clinic
    const supabase = await createTypedClient()
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const result = await getPatientHistory(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ history: result.history })
  } catch (error) {
    return handleApiError(error)
  }
}