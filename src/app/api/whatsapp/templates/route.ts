import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import {
  getApprovedTemplates,
  getAllTemplates,
  createTemplate,
  type MessageTemplate,
} from '@/services/whatsapp/message-templates.service'

/**
 * GET /api/whatsapp/templates
 * List message templates (approved only by default)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const all = new URL(request.url).searchParams.get('all') === 'true'

    const templates = all
      ? await getAllTemplates(clinicId)
      : await getApprovedTemplates(clinicId)

    return NextResponse.json({ templates })
  } catch (error) {
    console.error('Error fetching templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/whatsapp/templates
 * Create a new message template
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const body = await request.json()
    const { name, category, body: templateBody, header, footer, buttons } = body

    if (!name || !category || !templateBody) {
      return NextResponse.json(
        { error: 'Missing required fields: name, category, body' },
        { status: 400 }
      )
    }

    const template = await createTemplate({
      clinicId,
      name,
      category,
      body: templateBody,
      header,
      footer,
      buttons,
    })

    if (!template) {
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template })
  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
