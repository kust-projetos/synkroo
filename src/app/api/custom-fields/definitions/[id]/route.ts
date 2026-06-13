import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import {
  getDefinitionById,
  updateDefinition,
  deleteDefinition,
} from '@/services/custom-fields/definitions.service'
import { z } from 'zod'

const updateDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  required: z.boolean().optional(),
  sort_order: z.number().optional(),
  is_active: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { id } = await params

  const definition = await getDefinitionById(clinicId, id)

  if (!definition) {
    return NextResponse.json({ error: 'Definition not found' }, { status: 404 })
  }

  return NextResponse.json(definition)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { id } = await params

  try {
    const body = await request.json()
    const validated = updateDefinitionSchema.parse(body)

    const definition = await updateDefinition(clinicId, id, validated)
    return NextResponse.json(definition)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update definition' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiAuth()
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { id } = await params

  try {
    await deleteDefinition(clinicId, id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete definition' }, { status: 500 })
  }
}