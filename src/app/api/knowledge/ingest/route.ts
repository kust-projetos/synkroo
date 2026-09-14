import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { ragService } from '@/services/rag';

/**
 * B1 — bounds de chunking: chunkSize 100–2000, overlap 0–500.
 * Fora da faixa FINITA → clamp; lixo não-numérico → 400. chunkSize absurdo
 * estoura embedding/pgvector; overlap >= size gera loop de chunks vazios.
 */
const IngestBodySchema = z.object({
  category: z.string().trim().min(1),
  content: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  chunkSize: z.coerce.number().int().finite().optional(),
  chunkOverlap: z.coerce.number().int().finite().optional(),
});

const clampInt = (v: number | undefined, fallback: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, Math.floor(v ?? fallback)));

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
    const parsed = IngestBodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => String(i.path[0]));
      const missing = ['category', 'content'].find((f) => paths.includes(f));
      return NextResponse.json(
        {
          error: missing
            ? `Field "${missing}" is required`
            : 'Invalid chunking parameters (chunkSize/chunkOverlap must be finite numbers)',
        },
        { status: 400 },
      );
    }
    const { category, content, title, chunkSize: rawSize, chunkOverlap: rawOverlap } = parsed.data;

    const result = await ragService.ingestDocument(clinicId, {
      category,
      content,
      title,
      chunkSize: rawSize === undefined ? undefined : clampInt(rawSize, 500, 100, 2000),
      chunkOverlap: rawOverlap === undefined ? undefined : clampInt(rawOverlap, 50, 0, 500),
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
