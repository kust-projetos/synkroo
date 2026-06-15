import { NextRequest, NextResponse } from 'next/server'
import { eq, and, or, ilike, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { validateApiAuth } from '@/lib/auth/session'
import { ragService } from '@/services/rag'
import { handleApiError, DatabaseError } from '@/lib/errors'

const KB = knowledgeBase

function toSnake(r: any) {
  return {
    id: r.id, clinic_id: r.clinicId, category: r.category, question: r.question,
    answer: r.answer, keywords: r.keywords ?? [], is_active: r.isActive,
    created_at: r.createdAt?.toISOString?.() ?? null,
    updated_at: r.updatedAt?.toISOString?.() ?? null,
  }
}

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

    const rows = await db.select({
      id: KB.id, category: KB.category, question: KB.question, answer: KB.answer,
      keywords: KB.keywords, isActive: KB.isActive, createdAt: KB.createdAt, updatedAt: KB.updatedAt,
    }).from(KB).where(and(...conditions)).orderBy(desc(KB.createdAt)).limit(limit)

    return NextResponse.json({ data: rows.map(toSnake) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id
    const { category, question, answer, keywords } = await request.json()

    if (!category || !question || !answer) {
      return NextResponse.json({ error: 'Missing required fields: category, question, answer' }, { status: 400 })
    }

    const id = await ragService.addKnowledgeEntry(clinicId, category, question, answer, keywords || [])
    if (!id) return NextResponse.json({ error: 'Failed to create knowledge entry' }, { status: 500 })

    return NextResponse.json({ success: true, id, message: 'Knowledge entry created with embedding' })
  } catch (error) {
    return handleApiError(error)
  }
}
