import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import {
  getDefinitionById,
  updateDefinition,
  deleteDefinition,
} from '@/services/custom-fields/definitions.service'
import { updateCustomFieldDefinitionSchema } from '@/lib/validations/custom-fields'
import { z } from 'zod'

type RouteParams = { params: Promise<{ id: string }> }

async function handleGET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth('crm:view')
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id
  const { id } = await params

  const definition = await getDefinitionById(clinicId, id)

  if (!definition) {
    return apiFailure('NOT_FOUND', 'Definition not found', requestId, 404)
  }

  return apiSuccess(definition)
}

async function handlePUT(
  request: NextRequest,
  { params }: RouteParams,
) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth('crm:manage_tags')
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id
  const { id } = await params

  try {
    const body = await request.json()
    const validated = updateCustomFieldDefinitionSchema.parse(body)

    const definition = await updateDefinition(clinicId, id, validated)
    return apiSuccess(definition)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    return apiFailure('INTERNAL_ERROR', 'Failed to update definition', requestId, 500)
  }
}

async function handleDELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth('crm:manage_tags')
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id
  const { id } = await params

  try {
    await deleteDefinition(clinicId, id)
    return apiSuccess({ success: true })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Failed to delete definition', requestId, 500)
  }
}

export const GET = withModuleRoute('crm')(handleGET)
export const PUT = withModuleRoute('crm')(handlePUT)
export const DELETE = withModuleRoute('crm')(handleDELETE)
