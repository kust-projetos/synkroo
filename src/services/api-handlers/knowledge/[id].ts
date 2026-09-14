import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'

const KB = knowledgeBase

function toCamel(r: any) {
  return {
    id: r.id,
    clinicId: r.clinicId,
    category: r.category,
    question: r.question,
    answer: r.answer,
    keywords: r.keywords ?? [],
    embedding: r.embedding,
    isActive: r.isActive,
    createdAt: r.createdAt?.toISOString?.() ?? null,
    updatedAt: r.updatedAt?.toISOString?.() ?? null,
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
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('ia:chat')
    if (!authResult.success)
      return apiAuthFailure(authResult.error, requestId)
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const db = getDb()

    const [row] = await db
      .select()
      .from(KB)
      .where(and(eq(KB.id, id), eq(KB.clinicId, clinicId)))
    if (!row) return apiFailure('NOT_FOUND', 'Entry not found', requestId, 404)

    return apiSuccess(toCamel(row))
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * PUT /api/knowledge/[id]
 * Update a tenant-scoped knowledge entry. Embeddings remain optional.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = generateRequestId()
  try {
    const auth = await validateApiAuth('ia:manage')
    if (!auth.success) return apiAuthFailure(auth.error, requestId)

    const { id } = await params
    const body = await request.json() as Record<string, unknown>
    const updateData: Record<string, unknown> = {}
    for (const field of ['category', 'question', 'answer'] as const) {
      if (typeof body[field] === 'string' && body[field].trim()) updateData[field] = body[field].trim()
    }
    if (Array.isArray(body.keywords)) {
      updateData.keywords = body.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
    }
    if (typeof body.isActive === 'boolean') updateData.isActive = body.isActive
    if (Object.keys(updateData).length === 0) return apiFailure('INVALID_INPUT', 'No valid fields to update', requestId, 400)

    const [row] = await getDb().update(KB).set({ ...updateData, updatedAt: new Date() }).where(
      and(eq(KB.id, id), eq(KB.clinicId, auth.profile!.clinic_id)),
    ).returning()
    if (!row) return apiFailure('NOT_FOUND', 'Entry not found', requestId, 404)
    return apiSuccess(toCamel(row))
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
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
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('ia:manage')
    if (!authResult.success)
      return apiAuthFailure(authResult.error, requestId)
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const db = getDb()

    await db.delete(KB).where(and(eq(KB.id, id), eq(KB.clinicId, clinicId)))
    return apiSuccess({ success: true })
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
