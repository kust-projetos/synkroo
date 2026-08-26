/**
 * LGPD Anonymize API Route
 * POST /api/lgpd/anonymize
 * LGPD-03: Anonymizes patient data with audit trail
 * Migrated from Supabase to Drizzle ORM.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { patients } from '@/modules/operacional/schema'
import { appointments } from '@/lib/db/schema/appointments'
import { budgets } from '@/lib/db/schema/business'
import { leads } from '@/lib/db/schema/crm'
import { auditLogs } from '@/lib/db/schema/infra'
import { eq, and } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error?.message || 'Unauthorized' },
        { status: authResult.error?.status || 401 },
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const userId = authResult.profile!.id
    const requestId = crypto.randomUUID()

    const body = await request.json()
    const { patientId } = body

    if (!patientId) {
      return NextResponse.json({ error: 'Missing required field: patientId' }, { status: 400 })
    }

    const db = getDb()
    const anonymizedHex = crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    const anonymizedName = `ANONYMIZED_${anonymizedHex}`

    // Step 0: Capture patient snapshot before anonymization
    const [snapshot] = await db.select()
      .from(patients)
      .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
      .limit(1)

    if (!snapshot) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 })
    }

    // F10.10 legal_hold impede purge
    if ((snapshot as any).legalHold) {
      return NextResponse.json({ error: 'Patient under legal hold' }, { status: 423 })
    }

    const oldValues = {
      name: snapshot.name,
      phone: snapshot.phone,
      email: snapshot.email,
      cpf: snapshot.cpf,
      birthDate: snapshot.birthDate,
    }

    const newValues = {
      name: anonymizedName,
      phone: null,
      email: null,
      cpf: null,
      birthDate: null,
    }

    // F10.07 transaction: patients + appointments + budgets + leads + audit em 1 tx
    await db.transaction(async (tx) => {
      await tx.update(patients)
        .set(newValues as any)
        .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))

      await tx.update(appointments)
        .set({ notes: '[ANONYMIZED]' })
        .where(and(eq(appointments.patientId, patientId), eq(appointments.clinicId, clinicId)))

      await tx.update(budgets)
        .set({ notes: '[ANONYMIZED]' })
        .where(and(eq(budgets.patientId, patientId), eq(budgets.clinicId, clinicId)))

      await tx.update(leads)
        .set({ name: '[ANONYMIZED]', phone: null, email: null } as any)
        .where(and(eq(leads.patientId, patientId), eq(leads.clinicId, clinicId)))

      await tx.insert(auditLogs).values({
        clinicId,
        userId,
        action: 'patient_anonymized',
        entityType: 'patient',
        entityId: patientId,
        oldValues: oldValues as any,
        newValues: newValues as any,
        ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
        userAgent: request.headers.get('user-agent') ?? null,
      })
    })

    return NextResponse.json({ success: true, auditId: requestId })
  } catch (error) {
    console.error('LGPD anonymize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
