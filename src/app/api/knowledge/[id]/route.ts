import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { ragService, embeddingService } from '@/services/rag'
import { dbLogger } from '@/lib/logger'

/**
 * GET /api/knowledge/[id]
 * Get a specific knowledge base entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const supabase = await createTypedClient()

    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    dbLogger.error('Knowledge entry fetch error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/knowledge/[id]
 * Update a knowledge base entry and regenerate embedding
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const body = await request.json()
    const supabase = await createTypedClient()

    const { category, question, answer, keywords, is_active } = body

    // Build update object
    const updateData: Record<string, unknown> = {}

    if (category !== undefined) updateData.category = category
    if (question !== undefined) updateData.question = question
    if (answer !== undefined) updateData.answer = answer
    if (keywords !== undefined) updateData.keywords = keywords
    if (is_active !== undefined) updateData.is_active = is_active

    // Regenerate embedding if question or answer changed
    if (question || answer) {
      // Get current entry
      const { data: current } = await supabase
        .from('knowledge_base')
        .select('question, answer')
        .eq('id', id)
        .eq('clinic_id', clinicId)
        .single()

      if (current) {
        const text = `${question || current.question}\n${answer || current.answer}`
        const { embedding } = await embeddingService.generateEmbedding(text)
        updateData.embedding = embedding
      }
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      dbLogger.error('Error updating knowledge entry', error)
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    dbLogger.error('Knowledge entry update error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/knowledge/[id]
 * Delete a knowledge base entry
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const supabase = await createTypedClient()

    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) {
      dbLogger.error('Error deleting knowledge entry', error)
      return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    dbLogger.error('Knowledge entry delete error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}