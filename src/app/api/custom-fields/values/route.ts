import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import {
  getValuesForContact,
  upsertValues,
  deleteValuesForContact,
} from '@/services/custom-fields/values.service'
import { upsertCustomFieldValuesSchema } from '@/lib/validations/custom-fields'
import { z } from 'zod'

async function handleGET(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth('crm:view')
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  const contactId = searchParams.get('contact_id')
  const contactType = searchParams.get('contact_type') as 'patient' | 'lead'

  if (!contactId || !contactType) {
    return apiFailure(
      'INVALID_INPUT',
      'contact_id and contact_type query parameters are required',
      requestId,
      400,
    )
  }

  const values = await getValuesForContact(clinicId, contactId, contactType)
  return apiSuccess(values)
}

async function handlePOST(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth('crm:manage_tags')
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id

  try {
    const body = await request.json()
    const { contact_id, contact_type, values } = upsertCustomFieldValuesSchema.parse(body)

    const result = await upsertValues(
      clinicId,
      contact_id,
      contact_type,
      values.map(v => ({ definition_id: v.definition_id, value: v.value }))
    )
    return apiSuccess(result, undefined, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    return apiFailure('INTERNAL_ERROR', 'Failed to upsert values', requestId, 500)
  }
}

async function handleDELETE(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth('crm:manage_tags')
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  const contactId = searchParams.get('contact_id')
  const contactType = searchParams.get('contact_type') as 'patient' | 'lead'

  if (!contactId || !contactType) {
    return apiFailure(
      'INVALID_INPUT',
      'contact_id and contact_type query parameters are required',
      requestId,
      400,
    )
  }

  try {
    await deleteValuesForContact(clinicId, contactId, contactType)
    return apiSuccess({ success: true })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Failed to delete values', requestId, 500)
  }
}

export const GET = withModuleRoute('crm')(handleGET)
export const POST = withModuleRoute('crm')(handlePOST)
export const DELETE = withModuleRoute('crm')(handleDELETE)
