import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getContactById, updateContact, archiveContact } from '@/services/contacts/contacts.service'
import { z } from 'zod'

const updateContactSchema = z.object({
  type: z.enum(['patient', 'lead']),
  name: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  cpf: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional().nullable(),
  status: z.string().optional(),
  interest: z.string().optional().nullable(),
  score: z.number().optional(),
  temperature: z.string().optional(),
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
  const contact = await getContactById(clinicId, id, type)

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  return NextResponse.json(contact)
}

export async function PUT(
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
    const validated = updateContactSchema.parse(body)
    const { type, ...updateData } = validated

    const contact = await updateContact(clinicId, id, type, updateData)
    return NextResponse.json(contact)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }
}

export async function PATCH(
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
    const { type } = body

    if (!type) {
      return NextResponse.json({ error: 'type required' }, { status: 400 })
    }

    const contact = await archiveContact(clinicId, id, type)
    return NextResponse.json(contact)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to archive contact' }, { status: 500 })
  }
}