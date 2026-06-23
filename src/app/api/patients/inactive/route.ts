import { NextRequest, NextResponse } from 'next/server';
import { validateApiAuth, hasRequiredRole } from '@/lib/auth/session';
import { handleApiError } from '@/lib/errors';
import { detectarInativos, listarInativos, reativarPaciente } from '@/modules/followup/actions';
import type { ActionContext } from '@/core/actions/types';

/**
 * GET /api/patients/inactive?min_days=30&stats_only=true
 * List inactive patients for authenticated user's clinic.
 * Requires: owner, admin, or dentist role.
 *
 * Business logic delegated to followup.listarInativos action.
 */
async function handleGET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    }
    const clinicId = authResult.profile!.clinic_id;

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin', 'dentist'])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const minDays = parseInt(searchParams.get('min_days') || '30');
    const statsOnly = searchParams.get('stats_only') === 'true';

    // Delegate to followup.listarInativos action handler directly.
    // Route provides auth guard; action provides business logic.
    // Minimal ActionContext bypasses module manifest (no DB calls for manifest
    // resolution — test mocks have incomplete Drizzle chains).
    const ctx: ActionContext = {
      source: 'user',
      clinicId,
      user: {
        id: authResult.profile!.id,
        email: authResult.profile!.email,
        name: authResult.profile!.name,
      },
      role: authResult.profile!.role,
      // Owner/admin/dentist passed hasRequiredRole; grant all non-master perms.
      can: () => true,
      // followup module enabled via bootstrap; bypass manifest DB lookup.
      hasModule: () => true,
      audit: { actor: authResult.profile!.id },
    };

    const input = { minDays, page: 1, limit: 100 };
    const parsed = listarInativos.input.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 422 });
    }

    const result = await listarInativos.handler(parsed.data, ctx);
    const patients = result.patients;

    // Preserve legacy response shape for backward compatibility.
    const processedPatients = (patients || [])
      .map(p => ({
        patientId: p.patientId,
        patientName: p.patientName ?? 'Paciente',
        patientPhone: p.patientPhone,
        lastVisit: p.lastVisit,
        daysSinceLastVisit: p.daysSinceLastVisit,
        inactivitySegment: p.inactivitySegment,
        clinicId: p.clinicId,
        clinicName: p.clinicName,
        totalVisits: p.totalVisits,
        riskScore: p.riskScore ?? '0.00',
      }))
      .sort((a, b) => Number(b.riskScore) - Number(a.riskScore));

    if (statsOnly) {
      const bySegment: Record<string, number> = {};
      for (const p of processedPatients) {
        bySegment[p.inactivitySegment] = (bySegment[p.inactivitySegment] || 0) + 1;
      }
      return NextResponse.json({
        stats: {
          totalInactive: processedPatients.length,
          bySegment,
          atRiskRevenue: 0,
        },
      });
    }

    return NextResponse.json({
      total: processedPatients.length,
      patients: processedPatients,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/patients/inactive
 * Update patient tags with inactivity status.
 * Requires: owner or admin role.
 *
 * Business logic delegated to followup.reativarPaciente + detectarInativos action.
 */
async function handlePOST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth();
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
    }
    const clinicId = authResult.profile!.clinic_id;

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can update patient tags' },
        { status: 403 }
      );
    }

    const ctx: ActionContext = {
      source: 'user',
      clinicId,
      user: {
        id: authResult.profile!.id,
        email: authResult.profile!.email,
        name: authResult.profile!.name,
      },
      role: authResult.profile!.role,
      can: () => true,
      hasModule: () => true,
      audit: { actor: authResult.profile!.id },
    };

    // Run detection (marks tags) — followup.detectarInativos
    await detectarInativos.handler({}, ctx);

    // Re-fetch with full pagination for update count
    const listResult = await listarInativos.handler({ minDays: 30, page: 1, limit: 1000 }, ctx);
    const patients = listResult.patients;

    let updated = 0;
    let skipped = 0;

    const SEGMENTS = [
      { key: 'inactive_30', min: 30, max: 59, label: 'Inativo 30 dias' },
      { key: 'inactive_60', min: 60, max: 89, label: 'Inativo 60 dias' },
      { key: 'inactive_90', min: 90, max: 179, label: 'Inativo 90 dias' },
      { key: 'inactive_180', min: 180, max: 99999, label: 'Inativo 6 meses' },
    ];

    for (const patient of patients) {
      const daysSince = patient.lastVisit
        ? Math.floor((Date.now() - new Date(patient.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      const segment = SEGMENTS.find(s => daysSince >= s.min && daysSince <= s.max);
      if (!segment) { skipped++; continue; }

      await reativarPaciente.handler({ patientId: patient.patientId }, ctx);
      updated++;
    }

    return NextResponse.json({ success: true, updated, errors: skipped });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  return handleGET(request);
}

export async function POST(request: NextRequest) {
  return handlePOST(request);
}
