import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import {
  addToWaitlist,
  getWaitlist,
  cancelWaitlistEntry,
  CreateWaitlistParams,
} from '@/services/waitlist/waitlist.service'
import { validateApiAuth } from '@/lib/supabase/server'

/**
 * GET /api/waitlist
 * List waitlist entries for a clinic
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const status = searchParams.get('status')
    const patientId = searchParams.get('patient_id')

    const entries = await getWaitlist(clinicId, {
      date: date || undefined,
      status: status || undefined,
      patientId: patientId || undefined,
    })

    return NextResponse.json({ waitlist: entries })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/waitlist
 * Add patient to waitlist
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.api,
      keyPrefix: 'waitlist-create',
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const body = await request.json()
    const {
      patient_id,
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      procedure_id,
      dentist_id,
      priority,
      notes,
    } = body

    // Validation
    if (!patient_id || !preferred_date || !preferred_time_start) {
      return NextResponse.json(
        { error: 'patient_id, preferred_date, and preferred_time_start are required' },
        { status: 400 }
      )
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(preferred_date)) {
      return NextResponse.json(
        { error: 'preferred_date must be in YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    // Validate date is in the future
    if (new Date(preferred_date) < new Date(new Date().toDateString())) {
      return NextResponse.json(
        { error: 'preferred_date must be today or in the future' },
        { status: 400 }
      )
    }

    const params: CreateWaitlistParams = {
      clinicId: clinicId,
      patientId: patient_id,
      preferredDate: preferred_date,
      preferredTimeStart: preferred_time_start,
      preferredTimeEnd: preferred_time_end,
      procedureId: procedure_id,
      dentistId: dentist_id,
      priority: priority,
      notes: notes,
    }

    const result = await addToWaitlist(params)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ entry: result.entry }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/waitlist
 * Cancel a waitlist entry
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const reason = searchParams.get('reason')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Verify the waitlist entry belongs to the clinic before canceling
    const supabase = await createClient()
    const { data: entry, error: fetchError } = await (supabase as any)
      .from('waitlist')
      .select('clinic_id')
      .eq('id', id)
      .single()

    if (fetchError || !entry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }

    if (entry.clinic_id !== clinicId) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }

    const result = await cancelWaitlistEntry(id, reason || undefined)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
