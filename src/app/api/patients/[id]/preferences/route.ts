import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { setPreference, getPreferences } from '@/services/patients/patient-preferences.service'
import * as patientRepo from '@/repositories/patients'
import { withModuleRoute } from '@/core/modules/gates'
import { createManifest } from '@/core/modules/manifest'

const OPERACIONAL_MODULE = 'operacional'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patients/[id]/preferences
 */
async function handleGET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth('operacional:view')
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const { id } = await params
    const clinicId = authResult.profile!.clinic_id

    const patient = await patientRepo.findByIdScoped(id, clinicId)
    if (!patient) {
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
async function handlePOST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const { id } = await params
    const clinicId = authResult.profile!.clinic_id

    const patient = await patientRepo.findByIdScoped(id, clinicId)
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

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
      clinicId,
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

async function handlePUT(request: NextRequest, ctx: RouteParams) {
  return handlePOST(request, ctx)
}

const wrappedGET = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handleGET)
const wrappedPOST = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePOST)
const wrappedPUT = withModuleRoute(OPERACIONAL_MODULE, createManifest())(handlePUT)

export async function GET(request: NextRequest, ctx: RouteParams) {
  return wrappedGET(request as any, ctx as any)
}

export async function POST(request: NextRequest, ctx: RouteParams) {
  return wrappedPOST(request as any, ctx as any)
}

export async function PUT(request: NextRequest, ctx: RouteParams) {
  return wrappedPUT(request as any, ctx as any)
}
