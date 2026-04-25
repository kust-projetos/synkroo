import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAllProcedureReminderConfigs,
  saveProcedureReminderConfig,
  getProcedureTypes,
  validateTemplate,
  type ReminderConfigPerProcedure,
} from '@/services/reminders/procedure-reminder-config.service'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'
import { handleApiError, ValidationError } from '@/lib/errors'

const saveConfigSchema = z.object({
  procedure_type_id: z.string(),
  hours_before: z.number().int().positive(),
  message_template: z.string().min(1),
  enabled: z.boolean(),
})

/**
 * GET /api/reminders/config
 * List all procedure reminder configs for the authenticated user's clinic
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }

    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin', 'dentist', 'receptionist'])) {
      return NextResponse.json({ error: 'Permissões insuficientes' }, { status: 403 })
    }

    const configs = await getAllProcedureReminderConfigs(clinicId)
    const procedureTypes = await getProcedureTypes(clinicId)

    // Enrich configs with procedure type names
    const enrichedConfigs = configs.map((config) => {
      const procedureType = procedureTypes.find((pt) => pt.id === config.procedure_type_id)
      return {
        ...config,
        procedure_type_name: procedureType?.name || config.procedure_type_id,
      }
    })

    return NextResponse.json({ configs: enrichedConfigs })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/reminders/config
 * Upsert a reminder config for a procedure type
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }

    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json({ error: 'Apenas owners e admins podem editar configurações' }, { status: 403 })
    }

    const rawBody = await request.json()
    const body = saveConfigSchema.parse(rawBody)

    // Validate template
    const templateValidation = validateTemplate(body.message_template)
    if (!templateValidation.valid) {
      throw new ValidationError('Template inválido', { issues: templateValidation.errors })
    }

    const result = await saveProcedureReminderConfig(clinicId, {
      procedure_type_id: body.procedure_type_id,
      procedure_type_name: '', // Will be enriched from procedure_types
      hours_before: body.hours_before,
      message_template: body.message_template,
      enabled: body.enabled,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, config: result.config })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}