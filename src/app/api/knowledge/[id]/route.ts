import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
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
    embedding: r.embedding,
    is_active: r.isActive,
    created_at: r.createdAt?.toISOString?.() ?? null,
    updated_at: r.updatedAt?.toISOString?.() ?? null,
  }
}

/**
 * GET /api/knowledge/[id]
 * DB read — works without RAG.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success)
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const db = getDb()

    const [row] = await db
      .select()
      .from(KB)
      .where(and(eq(KB.id, id), eq(KB.clinicId, clinicId)))
    if (!row) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    return NextResponse.json({ data: toSnake(row) })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * PUT /api/knowledge/[id]
 * Legacy RAG/embedding service removed — returns 501.
 * TODO(W5.3): reconnect knowledge ingestion to new retrieval backend.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })

    return NextResponse.json(
      {
        success: false,
        disabled: true,
        reason: 'legacy_rag_removed',
        todo: 'TODO(W5.3): reconnect knowledge ingestion to new retrieval backend',
      },
      { status: 501 }
    )
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

/**
 * DELETE /api/knowledge/[id]
 * DB delete — works without RAG.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success)
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const db = getDb()

    await db.delete(KB).where(and(eq(KB.id, id), eq(KB.clinicId, clinicId)))
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
