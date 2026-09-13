import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, lt, inArray, isNull, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { patients, appointments } from '@/lib/db/schema'
import { handleApiError } from '@/lib/errors'

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const db = getDb()
    const sp = new URL(request.url).searchParams
    const startDate = sp.get('start_date') || new Date(Date.now() - 30*86400000).toISOString().split('T')[0]
    const endDate = sp.get('end_date') || new Date().toISOString().split('T')[0]
    const endDateEnd = endDate + 'T23:59:59'

    // New patients in period
    const newPatients = await db.select({ id: patients.id, createdAt: patients.createdAt })
      .from(patients).where(and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt), gte(patients.createdAt, new Date(startDate)), lte(patients.createdAt, new Date(endDateEnd))))
    const bySource: Record<string,number> = { manual: newPatients.length }

    // Total patients
    const [totalRow] = await db.select({ count: sql<number>`count(*)::int` }).from(patients).where(and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt)))
    const totalPatients = totalRow?.count ?? 0

    // Active patients (had appointment in last 90 days) — tenant-scoped, aggregated in SQL
    const ninetyDaysAgo = new Date(Date.now() - 90*86400000)
    const activeRows = await db.select({ patientId: appointments.patientId }).from(appointments).where(and(eq(appointments.clinicId, clinicId), gte(appointments.scheduledAt, ninetyDaysAgo), inArray(appointments.status as any, ['completed', 'confirmed'])))
    const activeIds = new Set(activeRows.map(a=>a.patientId))
    const retentionRate = totalPatients ? Math.round((activeIds.size / totalPatients) * 100) : 0

    // Inactive list — tenant-scoped SQL with explicit limit/offset, never materialize whole clinic in JS (OOM guard)
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '50', 10) || 50))
    const offset = (page - 1) * limit
    const inactiveRows = await db.select({ id: patients.id, name: patients.name, phone: patients.phone, createdAt: patients.createdAt })
      .from(patients)
      .where(and(
        eq(patients.clinicId, clinicId),
        isNull(patients.deletedAt),
        sql`NOT EXISTS (SELECT 1 FROM ${appointments} WHERE ${appointments.patientId} = ${patients.id} AND ${appointments.clinicId} = ${clinicId} AND ${appointments.scheduledAt} >= ${ninetyDaysAgo} AND ${appointments.status} IN ('completed','confirmed'))`
      ))
      .limit(limit)
      .offset(offset)
    const inactiveList = inactiveRows.map(p => ({ id: p.id, name: p.name, phone: p.phone, created_at: p.createdAt?.toISOString?.() ?? null }))

    // Previous period growth
    const periodMs = new Date(endDate).getTime() - new Date(startDate).getTime()
    const prevStart = new Date(new Date(startDate).getTime() - periodMs)
    const prevEnd = new Date(startDate)
    const [prevRow] = await db.select({ count: sql<number>`count(*)::int` }).from(patients).where(and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt), gte(patients.createdAt, prevStart), lt(patients.createdAt, prevEnd)))
    const prevNew = prevRow?.count ?? 0
    const growth = prevNew ? Math.round(((newPatients.length - prevNew) / prevNew) * 100) : 0

    return NextResponse.json({
      period: { start: startDate, end: endDate },
      newPatients: { total: newPatients.length, bySource, growth },
      retention: { totalPatients, activePatients: activeIds.size, inactivePatients: inactiveList.length, retentionRate },
      inactiveList,
    })
  } catch (error) { return handleApiError(error) }
}
