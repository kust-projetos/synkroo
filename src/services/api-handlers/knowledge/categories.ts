import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { knowledgeBase } from '@/lib/db/schema/infra'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'

const KB = knowledgeBase

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const auth = await validateApiAuth('ia:chat')
    if (!auth.success) return apiAuthFailure(auth.error, requestId)
    const clinicId = auth.profile!.clinic_id
    const db = getDb()

    const rows = await db.select({ category: KB.category })
      .from(KB).where(and(eq(KB.clinicId, clinicId), eq(KB.isActive, true)))

    const catMap = new Map<string, number>()
    for (const r of rows) catMap.set(r.category, (catMap.get(r.category) || 0) + 1)

    const categories = Array.from(catMap.entries())
      .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

    return apiSuccess({ categories })
  } catch (error) { return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500) }
}
