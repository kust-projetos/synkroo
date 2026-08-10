import { NextRequest, NextResponse } from 'next/server'
import { eq, and, or, ilike, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { validateApiAuth } from '@/lib/auth/session'

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
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')

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

    return NextResponse.json({ data: rows.map(toSnake) })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * POST /api/knowledge
 * Create a tenant-scoped knowledge entry. Embeddings are optional and can be generated asynchronously.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    const body = await request.json() as Record<string, unknown>
    const category = typeof body.category === 'string' ? body.category.trim() : ''
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    const answer = typeof body.answer === 'string' ? body.answer.trim() : ''
    if (!category || !question || !answer) {
      return NextResponse.json({ error: 'category, question and answer are required' }, { status: 400 })
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

    return NextResponse.json({ data: toSnake(row) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
