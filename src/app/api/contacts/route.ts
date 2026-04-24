import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { searchContacts, createContact } from '@/services/contacts/contacts.service'
import { z } from 'zod'

const createContactSchema = z.object({
  type: z.enum(['patient', 'lead']),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  cpf: z.string().optional(),
  birth_date: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  interest: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  const params = {
    search: searchParams.get('search') || undefined,
    type: (searchParams.get('type') as 'all' | 'patient' | 'lead') || 'all',
    tags: searchParams.get('tags')?.split(',').filter(Boolean),
    status: searchParams.get('status') || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '20'),
  }

  try {
    const result = await searchContacts(clinicId, params)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to search contacts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id

  try {
    const body = await request.json()
    const validated = createContactSchema.parse(body)
    const contact = await createContact(clinicId, validated)
    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}