import { NextRequest } from 'next/server'
import { eq, and, or, ilike, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiCreated, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'

const KB = knowledgeBase

function toSnake(r: any) {
  return {
    id: r.id,
    clinic_id: r.clinicId,
    category: r.category,
    question: r.question,
    answer: r.answer,
    keywords: r.keywords ?? [],
    is_active: r.isActive,
    created_at: r.createdAt?.toISOString?.() ?? null,
    updated_at: r.updatedAt?.toISOString?.() ?? null,
  }
}

/**
 * GET /api/knowledge
 * List knowledge base entries.
 * DB read — works without RAG.
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const auth = await validateApiAuth('ia:chat')
    if (!auth.success) return apiAuthFailure(auth.error, requestId)
    const clinicId = auth.profile!.clinic_id
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    // B1: clamp defensivo (parseInt sem bound aceita gigante/NaN → fan-out/OOM)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50') || 50))

    const conditions: any[] = [eq(KB.clinicId, clinicId)]
    if (category) conditions.push(eq(KB.category, category))
    if (search) conditions.push(or(ilike(KB.question, `%${search}%`), ilike(KB.answer, `%${search}%`)))

    const rows = await db
      .select({
        id: KB.id,
        category: KB.category,
        question: KB.question,
        answer: KB.answer,
        keywords: KB.keywords,
        isActive: KB.isActive,
        createdAt: KB.createdAt,
        updatedAt: KB.updatedAt,
      })
      .from(KB)
      .where(and(...conditions))
      .orderBy(desc(KB.createdAt))
      .limit(limit)

    return apiSuccess(rows.map(toSnake))
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * POST /api/knowledge
 * Create a tenant-scoped knowledge entry. Embeddings are optional and can be generated asynchronously.
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const auth = await validateApiAuth('ia:manage')
    if (!auth.success) return apiAuthFailure(auth.error, requestId)

    const body = await request.json() as Record<string, unknown>
    const category = typeof body.category === 'string' ? body.category.trim() : ''
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
    if (!category || !question || !answer) {
      return apiFailure('INVALID_INPUT', 'category, question and answer are required', requestId, 400)
    }

    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
      : []
    const [row] = await getDb().insert(KB).values({
      clinicId: auth.profile!.clinic_id,
      category,
      question,
      answer,
      keywords,
      isActive: true,
    }).returning()

    return apiCreated(toSnake(row))
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
