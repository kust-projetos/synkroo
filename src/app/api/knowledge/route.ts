import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { ragService } from '@/services/rag'
import { handleApiError, DatabaseError } from '@/lib/errors'

/**
 * GET /api/knowledge
 * List knowledge base entries for the clinic
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
    const supabase = await createTypedClient()
    const { searchParams } = new URL(request.url)

    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('knowledge_base')
      .select('id, category, question, answer, keywords, is_active, created_at, updated_at')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq('category', category)
    }

    if (search) {
      query = query.or(`question.ilike.%${search}%,answer.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      return handleApiError(new DatabaseError('Failed to fetch knowledge base', error))
    }

    return NextResponse.json({ data })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/knowledge
 * Create a new knowledge base entry with embedding
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

    const { category, question, answer, keywords } = body

    if (!category || !question || !answer) {
      return NextResponse.json(
        { error: 'Missing required fields: category, question, answer' },
        { status: 400 }
      )
    }

    // Create with embedding
    const id = await ragService.addKnowledgeEntry(
      clinicId,
      category,
      question,
      answer,
      keywords || []
    )

    if (!id) {
      return NextResponse.json(
        { error: 'Failed to create knowledge entry' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id,
      message: 'Knowledge entry created with embedding',
    })
  } catch (error) {
    return handleApiError(error)
  }
}