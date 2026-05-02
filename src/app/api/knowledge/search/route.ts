import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { embeddingService } from '@/services/rag'
import { handleApiError, DatabaseError } from '@/lib/errors'

/**
 * POST /api/knowledge/search
 * Semantic search in knowledge base using RAG
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
    const { query, threshold, limit } = body

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required field: query' },
        { status: 400 }
      )
    }

    // Generate embedding for query
    const { embedding } = await embeddingService.generateEmbedding(query)

    // Search using RPC function
    const supabase = await createClient()
    const { data, error } = await (supabase as any).rpc('search_knowledge_base', {
      query_embedding: embedding,
      p_clinic_id: clinicId,
      match_threshold: threshold || 0.7,
      match_count: limit || 5,
    })

    if (error) {
      return handleApiError(new DatabaseError('Search failed', error))
    }

    return NextResponse.json({
      query,
      results: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}