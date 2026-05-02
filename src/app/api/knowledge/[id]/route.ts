import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { ragService, embeddingService } from '@/services/rag'
import { handleApiError, DatabaseError } from '@/lib/errors'

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
    const supabase = await createClient()

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
    return handleApiError(error)
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
    const supabase = await createClient()

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
        .single() as { data: { question: string; answer: string } | null }

      if (current) {
        const text = `${question || current.question}\n${answer || current.answer}`
        const { embedding } = await embeddingService.generateEmbedding(text)
        updateData.embedding = embedding
      }
    }

    const { data, error } = await (supabase
      .from('knowledge_base') as any)
      .update(updateData)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) {
      return handleApiError(new DatabaseError('Failed to update entry', error))
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return handleApiError(error)
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
    const supabase = await createClient()

    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .eq('clinic_id', clinicId)

    if (error) {
      return handleApiError(new DatabaseError('Failed to delete entry', error))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}