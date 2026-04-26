import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/contacts/[id]/appointments
 * Fetch appointments for a contact (patient)
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
      return NextResponse.json({ error: 'Contact ID is required' }, { status: 400 })
    }

    const supabase = await createTypedClient()

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        status,
        notes,
        duration_minutes,
        patients (name),
        dentists (name),
        procedures (name)
      `)
      .eq('patient_id', id)
      .eq('clinic_id', clinicId)
      .order('scheduled_at', { ascending: false })

    if (error) {
      throw error
    }

    // Normalize the joined data
    const appointments = (data || []).map((apt: any) => {
      const patient = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients
      const dentist = Array.isArray(apt.dentists) ? apt.dentists[0] : apt.dentists
      const procedure = Array.isArray(apt.procedures) ? apt.procedures[0] : apt.procedures

      return {
        id: apt.id,
        scheduledAt: apt.scheduled_at,
        status: apt.status,
        notes: apt.notes,
        durationMinutes: apt.duration_minutes,
        patientName: patient?.name || '',
        dentistName: dentist?.name || '',
        procedureName: procedure?.name || '',
      }
    })

    return NextResponse.json({ appointments })
  } catch (error) {
    return handleApiError(error)
  }
}