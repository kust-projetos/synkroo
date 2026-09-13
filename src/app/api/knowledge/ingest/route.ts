import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { ragService } from '@/services/rag';

/**
 * POST /api/knowledge/ingest
 * Ingest document with automatic chunking and embedding generation.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth('ia:manage');
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status },
      );
    }

    const clinicId = authResult.profile!.clinic_id;
    const body = await request.json();
    const { category, content, title, chunkSize, chunkOverlap } = body;

    if (!category || typeof category !== 'string' || !category.trim()) {
      return NextResponse.json(
        { error: 'Field "category" is required' },
        { status: 400 },
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Field "content" is required' },
        { status: 400 },
      );
    }

    const result = await ragService.ingestDocument(clinicId, {
      category: category.trim(),
      content: content.trim(),
      title: typeof title === 'string' ? title.trim() : undefined,
      chunkSize: typeof chunkSize === 'number' ? chunkSize : undefined,
      chunkOverlap: typeof chunkOverlap === 'number' ? chunkOverlap : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
