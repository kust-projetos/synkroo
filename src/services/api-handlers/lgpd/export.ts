/**
 * LGPD Data Export API Route
 * POST /api/lgpd/export
 * LGPD-02: Provides patient data portability
 * Migrated from Supabase to Drizzle ORM.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { patients } from '@/modules/operacional/schema'
import { appointments } from '@/lib/db/schema/appointments'
import { budgets, payments } from '@/lib/db/schema/business'
import { consents } from '@/lib/db/schema/infra'
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

    const body = await request.json()
    const { patientId } = body

    if (!patientId) {
      return NextResponse.json({ error: 'Missing required field: patientId' }, { status: 400 })
    }

    const db = getDb()

    const [patientResult, appointmentsResult, budgetsResult, paymentsResult, consentsResult] =
      await Promise.all([
        db.select().from(patients)
          .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
          .limit(1),

        db.select().from(appointments)
          .where(and(eq(appointments.patientId, patientId), eq(appointments.clinicId, clinicId))),

        db.select().from(budgets)
          .where(and(eq(budgets.patientId, patientId), eq(budgets.clinicId, clinicId))),

        db.select().from(payments)
          .where(and(eq(payments.patientId, patientId), eq(payments.clinicId, clinicId))),

        db.select().from(consents)
          .where(and(
            eq(consents.contactId, patientId),
            eq(consents.contactType, 'patient'),
          )),
      ])

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      patient: patientResult[0] || null,
      appointments: appointmentsResult,
      budgets: budgetsResult,
      payments: paymentsResult,
      consents: consentsResult,
    })
  } catch (error) {
    console.error('LGPD export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
