import { NextRequest, NextResponse } from 'next/server'
import { eq, and, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, DatabaseError } from '@/lib/errors'

const KB = knowledgeBase

export async function GET(request: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id
    const db = getDb()

    const rows = await db.select({ category: KB.category })
      .from(KB).where(and(eq(KB.clinicId, clinicId), eq(KB.isActive, true)))

    const catMap = new Map<string, number>()
    for (const r of rows) catMap.set(r.category, (catMap.get(r.category) || 0) + 1)

    const categories = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

    return NextResponse.json({ categories })
  } catch (error) { return handleApiError(error) }
}
