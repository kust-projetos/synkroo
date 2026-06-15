import { NextRequest, NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { pipelineStages, leads } from '@/lib/db/schema'
import { validateApiAuth } from '@/lib/auth/session'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await validateApiAuth()
    if (!auth.success) return NextResponse.json({ error: auth.error!.message }, { status: auth.error!.status })
    const clinicId = auth.profile!.clinic_id
    const { id } = await params
    const { stage_id, version } = await req.json()
    if (!stage_id) return NextResponse.json({ error: 'stage_id is required' }, { status: 400 })

    const db = getDb()

    // Verify stage belongs to clinic
    const [stage] = await db.select({ id: pipelineStages.id }).from(pipelineStages).where(and(eq(pipelineStages.id, stage_id), eq(pipelineStages.clinicId, clinicId)))
    if (!stage) return NextResponse.json({ error: 'Stage not found' }, { status: 404 })

    // Version-based conflict detection
    if (version) {
      const [current] = await db.select({ id: leads.id, updatedAt: leads.updatedAt }).from(leads).where(and(eq(leads.id, id), eq(leads.clinicId, clinicId)))
      if (current?.updatedAt && new Date(version).getTime() !== current.updatedAt.getTime()) {
        return NextResponse.json({ error: 'Lead was modified by another user', conflict: true, currentState: current }, { status: 409 })
      }
    }

    // Update stage
    const [updated] = await db.update(leads).set({ stageId: stage_id, updatedAt: new Date() }).where(and(eq(leads.id, id), eq(leads.clinicId, clinicId))).returning()
    if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    return NextResponse.json({ data: { id: updated.id, stage_id: updated.stageId } })
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }) }
}
