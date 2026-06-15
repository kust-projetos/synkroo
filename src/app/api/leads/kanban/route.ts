import { NextRequest, NextResponse } from 'next/server'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { leads, pipelineStages } from '@/lib/db/schema'
import { validateApiAuth } from '@/lib/auth/session'

function toSnake(l: any, ps: any) {
  return {
    id: l.id, name: l.name, phone: l.phone, email: l.email,
    source: l.source, temperature: l.temperature, score: l.score,
    stage_id: l.stageId, interest: l.interest,
    last_contact_at: l.lastContactAt?.toISOString?.() ?? null,
    created_at: l.createdAt?.toISOString?.() ?? null,
    updated_at: l.updatedAt?.toISOString?.() ?? null,
    pipeline_stages: ps ? { id: ps.id, name: ps.name, color: ps.color, sort_order: ps.position } : null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id
    const { searchParams } = new URL(req.url)
    const stageId = searchParams.get('stage_id')

    const db = getDb()
    const conditions: any[] = [eq(leads.clinicId, clinicId)]
    if (stageId) conditions.push(eq(leads.stageId, stageId))

    const rows = await db
      .select()
      .from(leads)
      .leftJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
      .where(and(...conditions))
      .orderBy(desc(leads.score))

    const result = rows.map((r: any) => toSnake(r.leads, r.pipeline_stages))
    return NextResponse.json({ leads: result })
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }) }
}
