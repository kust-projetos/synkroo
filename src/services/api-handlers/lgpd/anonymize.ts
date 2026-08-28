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
    const { buildUserContext } = await import('@/core/actions/context');
    const { runAction } = await import('@/core/actions/run');
    const { anonimizarPaciente } = await import('@/modules/operacional/actions/anonimizar-paciente');
    const ctx = await buildUserContext();
    const body = await request.json();
    const { patientId } = body;
    if (!patientId) {
      return NextResponse.json({ error: 'Missing required field: patientId' }, { status: 400 });
    }
    const result = await runAction(anonimizarPaciente, { patientId }, ctx);
    if (!result.ok) {
      const status = result.error.code === 'not_found' ? 404 : result.error.code === 'forbidden' ? 403 : result.error.code === 'conflict' ? 423 : 400;
      return NextResponse.json({ error: result.error.message }, { status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('LGPD anonymize error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
