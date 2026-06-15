import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { validateApiAuth } from '@/lib/auth/session'
import { ragService, embeddingService } from '@/services/rag'
import { handleApiError, DatabaseError } from '@/lib/errors'

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const db = getDb()

    const [row] = await db.select().from(KB).where(and(eq(KB.id, id), eq(KB.clinicId, clinicId)))
    if (!row) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    return NextResponse.json({ data: toSnake(row) })
  } catch (error) { return handleApiError(error) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const body = await request.json()
    const db = getDb()
    const { category, question, answer, keywords, is_active } = body

    const updateData: any = {}
    if (category !== undefined) updateData.category = category
    if (question !== undefined) updateData.question = question
    if (answer !== undefined) updateData.answer = answer
    if (keywords !== undefined) updateData.keywords = keywords
    if (is_active !== undefined) updateData.isActive = is_active

    if (question || answer) {
      const [current] = await db.select({ question: KB.question, answer: KB.answer }).from(KB).where(and(eq(KB.id, id), eq(KB.clinicId, clinicId)))
      if (current) {
        const text = `${question || current.question}\n${answer || current.answer}`
        const { embedding } = await embeddingService.generateEmbedding(text)
        updateData.embedding = embedding
      }
    }

    updateData.updatedAt = new Date()
    const [data] = await db.update(KB).set(updateData).where(and(eq(KB.id, id), eq(KB.clinicId, clinicId))).returning()
    if (!data) return handleApiError(new DatabaseError('Failed to update entry', new Error('Not found')))

    return NextResponse.json({ success: true, data: toSnake(data) })
  } catch (error) { return handleApiError(error) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const db = getDb()

    await db.delete(KB).where(and(eq(KB.id, id), eq(KB.clinicId, clinicId)))
    return NextResponse.json({ success: true })
  } catch (error) { return handleApiError(error) }
}
