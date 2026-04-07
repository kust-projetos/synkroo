import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { setPreference, getPreferences } from '@/services/patients/patient-preferences.service'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patients/[id]/preferences
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const { id } = await params
    const clinicId = authResult.profile!.clinic_id

    // Verify the patient belongs to the user's clinic
    const { createTypedClient } = await import('@/lib/supabase/typed')
    const supabase = await createTypedClient()

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const category = new URL(request.url).searchParams.get('category') as
      | 'scheduling' | 'communication' | 'clinical' | 'general'
      | null

    const preferences = await getPreferences(id, category || undefined)

    return NextResponse.json({ preferences })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/patients/[id]/preferences
 * Set a patient preference
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { key, value, category } = body

    if (!key || !value || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: key, value, category' },
        { status: 400 }
      )
    }

    const preference = await setPreference({
      patientId: id,
      clinicId: authResult.profile!.clinic_id,
      key,
      value,
      category,
    })

    if (!preference) {
      return NextResponse.json({ error: 'Failed to set preference' }, { status: 500 })
    }

    return NextResponse.json({ preference })
  } catch (error) {
    return handleApiError(error)
  }
}
