import { NextRequest, NextResponse } from 'next/server'
import { createClient, validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import {
  addObservation,
  getObservations,
  deleteObservation,
} from '@/services/patients/patient-preferences.service'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patients/[id]/observations
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
    const searchParams = new URL(request.url).searchParams
    const visibility = searchParams.get('visibility') as 'public' | 'team_only' | null
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const observations = await getObservations(id, {
      visibility: visibility || undefined,
      limit,
    })

    return NextResponse.json({ observations })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/patients/[id]/observations
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
    const { content, visibility } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const observation = await addObservation({
      patientId: id,
      clinicId: authResult.profile!.clinic_id,
      authorId: authResult.profile!.id,
      authorName: authResult.profile!.name || 'Unknown',
      content,
      visibility,
    })

    if (!observation) {
      return NextResponse.json({ error: 'Failed to add observation' }, { status: 500 })
    }

    return NextResponse.json({ observation })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/patients/[id]/observations?observation_id=xxx
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const supabase = await createClient()

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    const observationId = new URL(request.url).searchParams.get('observation_id')
    if (!observationId) {
      return NextResponse.json({ error: 'observation_id is required' }, { status: 400 })
    }

    const success = await deleteObservation(
      observationId,
      authResult.profile!.id
    )

    if (!success) {
      return NextResponse.json({ error: 'Failed to delete observation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
