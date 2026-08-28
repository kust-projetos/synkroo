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
    const { buildUserContext } = await import('@/core/actions/context');
    const { runAction } = await import('@/core/actions/run');
    const { exportarDadosPaciente } = await import('@/modules/operacional/actions/exportar-dados-paciente');
    const ctx = await buildUserContext();
    const body = await request.json();
    const { patientId } = body;
    if (!patientId) {
      return NextResponse.json({ error: 'Missing required field: patientId' }, { status: 400 });
    }
    const result = await runAction(exportarDadosPaciente, { patientId }, ctx);
    if (!result.ok) {
      const status = result.error.code === 'not_found' ? 404 : result.error.code === 'forbidden' ? 403 : 400;
      return NextResponse.json({ error: result.error.message }, { status });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    console.error('LGPD export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
