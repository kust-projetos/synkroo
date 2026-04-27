import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import {
  getValuesForContact,
  upsertValues,
  deleteValuesForContact,
} from '@/services/custom-fields/values.service'
import { z } from 'zod'

const upsertSchema = z.object({
  contact_id: z.string().uuid(),
  contact_type: z.enum(['patient', 'lead']),
  values: z.array(z.object({
    definition_id: z.string().uuid(),
    value: z.unknown(),
  })),
})

export async function GET(request: NextRequest) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  const contactId = searchParams.get('contact_id')
  const contactType = searchParams.get('contact_type') as 'patient' | 'lead'

  if (!contactId || !contactType) {
    return NextResponse.json(
      { error: 'contact_id and contact_type query parameters are required' },
      { status: 400 }
    )
  }

  const values = await getValuesForContact(clinicId, contactId, contactType)
  return NextResponse.json({ data: values })
}

export async function POST(request: NextRequest) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id

  try {
    const body = await request.json()
    const { contact_id, contact_type, values } = upsertSchema.parse(body)

    const result = await upsertValues(
      clinicId,
      contact_id,
      contact_type,
      values.map(v => ({ definition_id: v.definition_id, value: v.value }))
    )
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to upsert values' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  const contactId = searchParams.get('contact_id')
  const contactType = searchParams.get('contact_type') as 'patient' | 'lead'

  if (!contactId || !contactType) {
    return NextResponse.json(
      { error: 'contact_id and contact_type query parameters are required' },
      { status: 400 }
    )
  }

  try {
    await deleteValuesForContact(clinicId, contactId, contactType)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete values' }, { status: 500 })
  }
}