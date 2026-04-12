import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { clinicSettingsSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/clinics/settings
 * Get clinic settings
 */
export async function GET() {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const supabase = await createTypedClient()

    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('id, name, phone, email, settings')
      .eq('id', clinicId)
      .single()

    if (error) {
      return handleApiError(error)
    }

    return NextResponse.json({ settings: clinic })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/clinics/settings
 * Update clinic settings
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

    const clinicId = authResult.profile!.clinic_id
    const rawBody = await request.json()
    const body = clinicSettingsSchema.parse(rawBody)
    const supabase = await createTypedClient()

    const updateData: Record<string, unknown> = {}
    if (body.name) updateData.name = body.name
    if (body.phone) updateData.phone = body.phone
    if (body.email) updateData.email = body.email
    if (body.settings) updateData.settings = body.settings
    if (body.appointment_durations) {
      updateData.settings = {
        ...body.settings,
        appointment_durations: body.appointment_durations,
      }
    }

    const { error } = await (supabase
      .from('clinics') as any)
      .update(updateData)
      .eq('id', clinicId)

    if (error) {
      return handleApiError(error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}