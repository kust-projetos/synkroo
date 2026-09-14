import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { ragService } from '@/services/rag';

/**
 * B1 (knowledge untrusted) — bounds: limit 1–50, threshold 0–1.
 * Fora da faixa FINITA → clamp para o bound (sem fan-out de embedding nem
 * distorção de ranking); lixo não-numérico → 400. Sem clamp, `limit` gigante
 * vira fan-out de embedding/pgvector e injeção de volume no prompt.
 */
const SearchBodySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.coerce.number().int().finite().optional(),
  threshold: z.coerce.number().finite().optional(),
});

const clampInt = (v: number | undefined, fallback: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.floor(v ?? fallback)));
const clampNum = (v: number | undefined, fallback: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v ?? fallback));

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
    const parsed = SearchBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => String(i.path[0]));
      return NextResponse.json(
        {
          error: paths.includes('query')
            ? 'Missing required field: query'
            : 'Invalid search parameters (limit 1–50, threshold 0–1)',
        },
        { status: 400 },
      );
    }
    const { query, limit: rawLimit, threshold: rawThreshold } = parsed.data;
    const limit = clampInt(rawLimit, 5, 1, 50);
    const threshold = clampNum(rawThreshold, 0.5, 0, 1);

    const results = await ragService.searchKnowledge(clinicId, query, { limit, threshold });

    return NextResponse.json({
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}