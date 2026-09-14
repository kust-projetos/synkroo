import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import { setPreference, getPreferences } from '@/services/patients/patient-preferences.service'
import * as patientRepo from '@/repositories/patients'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/patients/[id]/preferences
 */
async function handleGET(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:view')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const { id } = await params
    const clinicId = authResult.profile!.clinic_id

    const patient = await patientRepo.findByIdScoped(id, clinicId)
    if (!patient) {
      return apiFailure('NOT_FOUND', 'Patient not found', requestId, 404)
    }

    const category = new URL(request.url).searchParams.get('category') as
      | 'scheduling' | 'communication' | 'clinical' | 'general'
      | null

    const preferences = await getPreferences(id, category || undefined)

    return apiSuccess({ preferences })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * POST /api/patients/[id]/preferences
 * Set a patient preference
 */
async function handlePOST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const { id } = await params
    const clinicId = authResult.profile!.clinic_id

    const patient = await patientRepo.findByIdScoped(id, clinicId)
    if (!patient) {
      return apiFailure('NOT_FOUND', 'Patient not found', requestId, 404)
    }

    const body = await request.json()
    const { key, value, category } = body

    if (!key || !value || !category) {
      return apiFailure(
        'INVALID_INPUT',
        'Missing required fields: key, value, category',
        requestId,
        400,
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
      return apiFailure('INTERNAL_ERROR', 'Failed to set preference', requestId, 500)
    }

    return apiSuccess({ preference })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

async function handlePUT(request: NextRequest, ctx: RouteParams) {
  return handlePOST(request, ctx)
}

export const GET = withModuleRoute('operacional')(handleGET)
export const POST = withModuleRoute('operacional')(handlePOST)
export const PUT = withModuleRoute('operacional')(handlePUT)
