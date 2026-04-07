import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { embeddingService } from '@/services/rag'
import { dbLogger } from '@/lib/logger'

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
    const supabase = await createTypedClient()
    const { data, error } = await supabase.rpc('search_knowledge_base', {
      query_embedding: embedding,
      p_clinic_id: clinicId,
      match_threshold: threshold || 0.7,
      match_count: limit || 5,
    })

    if (error) {
      dbLogger.error('Knowledge search error', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({
      query,
      results: data || [],
      count: data?.length || 0,
    })
  } catch (error) {
    dbLogger.error('Knowledge search error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}