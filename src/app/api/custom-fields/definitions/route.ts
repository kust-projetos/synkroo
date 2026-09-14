import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import {
  getDefinitions,
  createDefinition,
  exportDefinitions,
  importDefinitions,
} from '@/services/custom-fields/definitions.service'
import {
  createCustomFieldDefinitionSchema,
} from '@/lib/validations/custom-fields'
import { z } from 'zod'

async function handleGET(request: NextRequest) {
  const requestId = generateRequestId()
  const auth = await validateApiAuth('crm:view')
  if (!auth.success) {
    return apiAuthFailure(auth.error, requestId)
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  // Export mode
  if (searchParams.get('export') === 'true') {
    const exported = await exportDefinitions(clinicId)
    return apiSuccess(exported)
  }

  const definitions = await getDefinitions(clinicId)
  return apiSuccess(definitions)
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

    // Import mode
    if (body.version && body.definitions) {
      const importResult = await importDefinitions(clinicId, body)
      return apiSuccess(importResult, undefined, 201)
    }

    // Create mode
    const validated = createCustomFieldDefinitionSchema.parse(body)
    const definition = await createDefinition(clinicId, validated)
    return apiSuccess(definition, undefined, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    return apiFailure('INTERNAL_ERROR', 'Failed to create definition', requestId, 500)
  }
}

export const GET = withModuleRoute('crm')(handleGET)
export const POST = withModuleRoute('crm')(handlePOST)
