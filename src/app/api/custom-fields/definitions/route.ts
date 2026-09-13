import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import {
  getDefinitions,
  getDefinitionById,
  createDefinition,
  updateDefinition,
  deleteDefinition,
  exportDefinitions,
  importDefinitions,
} from '@/services/custom-fields/definitions.service'
import { z } from 'zod'

const createDefinitionSchema = z.object({
  name: z.string().min(1),
  field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox']),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  required: z.boolean().optional(),
  sort_order: z.number().optional(),
})

const updateDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  required: z.boolean().optional(),
  sort_order: z.number().optional(),
  is_active: z.boolean().optional(),
})

const importSchema = z.object({
  version: z.literal(1),
  exported_at: z.string(),
  definitions: z.array(z.object({
    name: z.string(),
    field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox']),
    options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    required: z.boolean().optional(),
    sort_order: z.number().optional(),
  })),
})

export async function GET(request: NextRequest) {
  const auth = await validateApiAuth('crm:view')
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id
  const { searchParams } = new URL(request.url)

  // Export mode
  if (searchParams.get('export') === 'true') {
    const exported = await exportDefinitions(clinicId)
    return NextResponse.json(exported)
  }

  const definitions = await getDefinitions(clinicId)
  return NextResponse.json({ data: definitions })
}

export async function POST(request: NextRequest) {
  const auth = await validateApiAuth('crm:manage_tags')
  if (!auth.success) {
    return NextResponse.json({ error: auth.error?.message }, { status: auth.error?.status })
  }

  const clinicId = auth.profile!.clinic_id

  try {
    const body = await request.json()

    // Import mode
    if (body.version && body.definitions) {
      const importResult = await importDefinitions(clinicId, body)
      return NextResponse.json(importResult, { status: 201 })
    }

    // Create mode
    const validated = createDefinitionSchema.parse(body)
    const definition = await createDefinition(clinicId, validated)
    return NextResponse.json(definition, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to create definition' }, { status: 500 })
  }
}