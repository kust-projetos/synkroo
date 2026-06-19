import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { searchKnowledgeBase } from '@/repositories/knowledge'

/**
 * POST /api/knowledge/search
 * Search knowledge base using keyword matching
 * (Vector similarity search requires pgvector integration)
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

    const results = await searchKnowledgeBase(
      clinicId,
      query,
      limit || 5
    )

    const filtered = threshold
      ? results.filter(r => r.relevance >= threshold)
      : results

    return NextResponse.json({
      query,
      results: filtered,
      count: filtered.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}