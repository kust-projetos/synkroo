import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { handleApiError } from '@/lib/errors'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import { getDb } from '@/lib/db/client'
import { waitlist } from '@/lib/db/schema'
import {
  addToWaitlist,
  getWaitlist,
  cancelWaitlistEntry,
  CreateWaitlistParams,
} from '@/services/waitlist/waitlist.service'
import { validateApiAuth } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const entries = await getWaitlist(clinicId, {
      date: searchParams.get('date') || undefined,
      status: searchParams.get('status') || undefined,
      patientId: searchParams.get('patient_id') || undefined,
    })
    return NextResponse.json({ waitlist: entries })
  } catch (error) { return handleApiError(error) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.api, keyPrefix: 'waitlist-create' })
    if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } })

    const body = await request.json() as Record<string, any>
    const { patient_id, preferred_date, preferred_time_start, preferred_time_end, procedure_id, dentist_id, priority, notes } = body
    if (!patient_id || !preferred_date || !preferred_time_start) {
      return NextResponse.json({ error: 'patient_id, preferred_date, and preferred_time_start are required' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(preferred_date)) return NextResponse.json({ error: 'preferred_date must be YYYY-MM-DD' }, { status: 400 })
    if (new Date(preferred_date) < new Date(new Date().toDateString())) return NextResponse.json({ error: 'preferred_date must be today or in the future' }, { status: 400 })

    const params: CreateWaitlistParams = { clinicId, patientId: patient_id, preferredDate: preferred_date, preferredTimeStart: preferred_time_start, preferredTimeEnd: preferred_time_end, procedureId: procedure_id, dentistId: dentist_id, priority, notes }
    const result = await addToWaitlist(params)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ entry: result.entry }, { status: 201 })
  } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    // Verify ownership via Drizzle
    const db = getDb()
    const [entry] = await db.select({ clinicId: waitlist.clinicId }).from(waitlist).where(eq(waitlist.id, id))
    if (!entry || entry.clinicId !== clinicId) return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })

    const result = await cancelWaitlistEntry(id, searchParams.get('reason') || undefined)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error) }
}
