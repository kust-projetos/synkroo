/**
 * LGPD Data Export API Route
 * POST /api/lgpd/export
 * LGPD-02: Provides patient data portability
 * Migrated from Supabase to Drizzle ORM.
 *
 * Note: consents field omitted — consents schema not yet unblocked.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getDb } from '@/lib/db/client'
import { patients } from '@/lib/db/schema/core'
import { appointments } from '@/lib/db/schema/appointments'
import { budgets, payments } from '@/lib/db/schema/business'
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

    const [patientResult, appointmentsResult, budgetsResult, paymentsResult] = await Promise.all([
      db.select().from(patients)
        .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
        .limit(1),

      db.select().from(appointments)
        .where(and(eq(appointments.patientId, patientId), eq(appointments.clinicId, clinicId))),

      db.select().from(budgets)
        .where(and(eq(budgets.patientId, patientId), eq(budgets.clinicId, clinicId))),

      db.select().from(payments)
        .where(and(eq(payments.patientId, patientId), eq(payments.clinicId, clinicId))),
    ])

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      patient: patientResult[0] || null,
      appointments: appointmentsResult,
      budgets: budgetsResult,
      payments: paymentsResult,
      // consents omitted — schema not yet unblocked (consents.patientId/contactId gap)
    })
  } catch (error) {
    console.error('LGPD export error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
