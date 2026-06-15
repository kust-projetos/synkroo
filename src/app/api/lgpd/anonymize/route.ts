/**
 * LGPD Anonymize API Route
 * POST /api/lgpd/anonymize
 * LGPD-03: Anonymizes patient data
 * Migrated from Supabase to Drizzle ORM.
 *
 * Note: audit_logs insertion skipped — audit schema not yet unblocked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { patients } from '@/lib/db/schema/core'
import { appointments } from '@/lib/db/schema/appointments'
import { budgets } from '@/lib/db/schema/business'
import { leads } from '@/lib/db/schema/crm'
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
    const requestId = crypto.randomUUID()

    const body = await request.json()
    const { patientId } = body

    if (!patientId) {
      return NextResponse.json({ error: 'Missing required field: patientId' }, { status: 400 })
    }

    const db = getDb()
    const anonymizedHex = crypto.randomUUID().replace(/-/g, '').substring(0, 8)
    const anonymizedName = `ANONYMIZED_${anonymizedHex}`

    // Step 1: Update patients
    const patientResult = await db.update(patients)
      .set({
        name: anonymizedName,
        phone: null,
        email: null,
        cpf: null,
        birthDate: null,
      } as any)
      .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))

    // Step 2: Update appointments notes
    await db.update(appointments)
      .set({ notes: '[ANONYMIZED]' })
      .where(and(eq(appointments.patientId, patientId), eq(appointments.clinicId, clinicId)))

    // Step 3: Update budgets notes
    await db.update(budgets)
      .set({ notes: '[ANONYMIZED]' })
      .where(and(eq(budgets.patientId, patientId), eq(budgets.clinicId, clinicId)))

    // Step 4: Update leads
    await db.update(leads)
      .set({ name: '[ANONYMIZED]', phone: null, email: null } as any)
      .where(and(eq(leads.patientId, patientId), eq(leads.clinicId, clinicId)))

    // Step 5: Audit log — SKIPPED (audit_logs schema not yet unblocked)
    // TODO: insert audit_logs entry with action='patient_anonymized' when schema is ready

    return NextResponse.json({ success: true, auditId: requestId })
  } catch (error) {
    console.error('LGPD anonymize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
