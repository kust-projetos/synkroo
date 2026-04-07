import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { clinicSettingsSchema } from '@/lib/validations'
import { apiLogger } from '@/lib/logger'

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
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    return NextResponse.json({ settings: clinic })
  } catch (error) {
    console.error('Error in GET /api/clinics/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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

    const { error } = await (supabase
      .from('clinics') as any)
      .update(updateData)
      .eq('id', clinicId)

    if (error) {
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PUT /api/clinics/settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}