import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { getDb } from '@/lib/db/client'
import { clinics } from '@/lib/db/schema'
import { clinicSettingsSchema } from '@/lib/validations'

export async function GET() {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const db = getDb()
    const [clinic] = await db.select({ id: clinics.id, name: clinics.name, phone: clinics.phone, email: clinics.email, settings: clinics.settings, timezone: clinics.timezone }).from(clinics).where(eq(clinics.id, clinicId))
    if (!clinic) return handleApiError(new Error('Clinic not found'))
    return NextResponse.json({ settings: clinic })
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const rawBody = await request.json()
    const body = clinicSettingsSchema.parse(rawBody)
    const db = getDb()

    const updateData: Record<string, unknown> = {}
    if (body.name) updateData.name = body.name
    if (body.phone) updateData.phone = body.phone
    if (body.email) updateData.email = body.email
    if (body.timezone) updateData.timezone = body.timezone
    if (body.settings) updateData.settings = body.settings
    if (body.appointment_durations) {
      updateData.settings = { ...body.settings, appointment_durations: body.appointment_durations }
    }

    await db.update(clinics).set(updateData as any).where(eq(clinics.id, clinicId))
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error) }
}
