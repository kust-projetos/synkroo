import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { ragService } from '@/services/rag';

/**
 * POST /api/knowledge/search
 * Search knowledge base using vector similarity (pgvector) with keyword fallback.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth('ia:chat');
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status },
      );
    }

    const clinicId = authResult.profile!.clinic_id;
    const body = await request.json();
    const { query, threshold, limit } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: query' },
        { status: 400 },
      );
    }

    const results = await ragService.searchKnowledge(clinicId, query.trim(), {
      limit: typeof limit === 'number' ? limit : 5,
      threshold: typeof threshold === 'number' ? threshold : 0.5,
    });

    return NextResponse.json({
      query: query.trim(),
      results,
      count: results.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}