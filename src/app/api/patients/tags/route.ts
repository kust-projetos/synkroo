import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import {
  getClinicTags,
  getSuggestedTags,
  addPatientTag,
  removePatientTag,
  setPatientTags,
  getPatientsByTag,
} from '@/services/patients/patient-tags.service'

/**
 * GET /api/patients/tags
 * List all tags or search patients by tag
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
    const searchParams = new URL(request.url).searchParams
    const tag = searchParams.get('tag')
    const suggest = searchParams.get('suggest') === 'true'

    if (tag) {
      const patients = await getPatientsByTag(clinicId, tag)
      return NextResponse.json({ tag, patients })
    }

    if (suggest) {
      const suggestions = await getSuggestedTags(clinicId)
      return NextResponse.json({ tags: suggestions })
    }

    const tags = await getClinicTags(clinicId)
    return NextResponse.json({ tags })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/patients/tags
 * Add or remove a tag from a patient
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
    const { patientId, tag, action } = body as {
      patientId: string
      tag: string
      action: 'add' | 'remove'
    }

    if (!patientId || !tag || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, tag, action' },
        { status: 400 }
      )
    }

    let success: boolean
    if (action === 'add') {
      success = await addPatientTag(patientId, tag)
    } else {
      success = await removePatientTag(patientId, tag)
    }

    if (!success) {
      return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/patients/tags
 * Set all tags for a patient (replace)
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const body = await request.json()
    const { patientId, tags } = body as {
      patientId: string
      tags: string[]
    }

    if (!patientId || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Missing required fields: patientId, tags' },
        { status: 400 }
      )
    }

    const success = await setPatientTags(patientId, tags)

    if (!success) {
      return NextResponse.json({ error: 'Failed to set tags' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
