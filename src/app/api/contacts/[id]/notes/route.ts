import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { getContactNotes, addContactNote } from '@/services/contacts/contacts.service'
import { z } from 'zod'

const addNoteSchema = z.object({
  type: z.enum(['patient', 'lead']),
  content: z.string().min(1),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as 'patient' | 'lead'

  if (!type) {
    return NextResponse.json({ error: 'type query parameter required' }, { status: 400 })
  }

  const clinicId = auth.profile!.clinic_id
  const notes = await getContactNotes(clinicId, id, type)

  return NextResponse.json({ data: notes })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const { id } = await params
  const clinicId = auth.profile!.clinic_id

  try {
    const body = await request.json()
    const { type, content } = addNoteSchema.parse(body)
    const note = await addContactNote(clinicId, id, type, content)
    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}