import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'
import { clinics } from '@/lib/db/schema'
import { clinicSettingsSchema } from '@/lib/validations'

export async function GET() {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return apiAuthFailure(authResult.error, requestId)
    const clinicId = authResult.profile!.clinic_id
    const db = getDb()
    const [clinic] = await db.select({ id: clinics.id, name: clinics.name, phone: clinics.phone, email: clinics.email, settings: clinics.settings, timezone: clinics.timezone }).from(clinics).where(eq(clinics.id, clinicId))
    if (!clinic) return apiFailure('NOT_FOUND', 'Clinic not found', requestId, 404)
    return apiSuccess({ settings: clinic })
  } catch (error) { return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500) }
}

export async function PUT(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return apiAuthFailure(authResult.error, requestId)
    const clinicId = authResult.profile!.clinic_id
    const rawBody = await request.json()
    const body = clinicSettingsSchema.parse(rawBody)
    const db = getDb()

    // Fetch existing to preserve unknown keys / credentials / channel metadata (e.g., whatsapp_phone_number_id)
    const [existing] = await db.select({ id: clinics.id, name: clinics.name, phone: clinics.phone, email: clinics.email, settings: clinics.settings, timezone: clinics.timezone }).from(clinics).where(eq(clinics.id, clinicId))
    if (!existing) return apiFailure('NOT_FOUND', 'Clinic not found', requestId, 404)

    const existingSettings = (existing.settings as Record<string, unknown>) ?? {}
    const incomingSettings = (body.settings as Record<string, unknown>) ?? {}
    // Server-side merge: preserve unknown keys, overlay only editable fields
    const mergedSettings: Record<string, unknown> = { ...existingSettings, ...incomingSettings }
    if (body.appointment_durations !== undefined) {
      mergedSettings.appointment_durations = body.appointment_durations
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.email !== undefined) updateData.email = body.email
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    // Only touch settings column if caller sent settings or appointment_durations, preserving otherwise
    if (body.settings !== undefined || body.appointment_durations !== undefined) {
      updateData.settings = mergedSettings
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(clinics).set(updateData as any).where(eq(clinics.id, clinicId))
    }
    return apiSuccess({ success: true })
  } catch (error) { return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500) }
}
