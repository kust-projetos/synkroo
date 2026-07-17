/**
 * GET /api/patients/inactive?min_days=30&stats_only=true
 * POST /api/patients/inactive
 *
 * Uses followup module actions backed by buildUserContext() + runAction().
 * Module gate: withModuleRoute('followup', moduleManifest).
 *
 * Authorization: actions/RBAC via runAction — no hasRequiredRole bypass.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { runAction } from '@/core/actions/run';
import { detectarInativos, listarInativos, reativarPaciente } from '@/modules/followup/actions';

const errorCodeToStatus: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_input: 422,
  module_disabled: 404,
  internal: 500,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildCtxError(err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

async function handleGET(request: NextRequest): Promise<NextResponse> {
  // 1. Build context — throws Error('unauthenticated') if no session
  let ctx;
  try {
    ctx = await buildUserContext();
  } catch (err: unknown) {
    return buildCtxError(err);
  }

  // 2. Parse query
  const { searchParams } = new URL(request.url);
  const minDays = parseInt(searchParams.get('min_days') || '30');
  const statsOnly = searchParams.get('stats_only') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '100');

  // 3. Run action via runAction (auth + RBAC + input validation)
  const result = await runAction(listarInativos, { minDays, page, limit }, ctx);
  if (!result.ok) {
    const status = errorCodeToStatus[result.error.code] ?? 500;
    return NextResponse.json({ error: result.error.message }, { status });
  }

  // 4. Transform response (preserve legacy shape)
  const patients = (result.data.patients || [])
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
    for (const p of patients) {
      bySegment[p.inactivitySegment] = (bySegment[p.inactivitySegment] || 0) + 1;
    }
    return NextResponse.json({
      stats: {
        totalInactive: patients.length,
        bySegment,
        atRiskRevenue: 0,
      },
    });
  }

  return NextResponse.json({ total: patients.length, patients });
}

// ─── POST ────────────────────────────────────────────────────────────────────

async function handlePOST(_request: NextRequest): Promise<NextResponse> {
  // 1. Build context
  let ctx;
  try {
    ctx = await buildUserContext();
  } catch (err: unknown) {
    return buildCtxError(err);
  }

  // 2. Detect inactive patients (tags)
  const detectResult = await runAction(detectarInativos, {}, ctx);
  if (!detectResult.ok) {
    const status = errorCodeToStatus[detectResult.error.code] ?? 500;
    return NextResponse.json({ error: detectResult.error.message }, { status });
  }

  // 3. Paginate listarInativos (schema max limit=100)
  type PatientItem = Awaited<ReturnType<typeof listarInativos.handler>>['patients'][number];
  const allPatients: PatientItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const listResult = await runAction(listarInativos, { minDays: 30, page, limit: 100 }, ctx);
    if (!listResult.ok) {
      const status = errorCodeToStatus[listResult.error.code] ?? 500;
      return NextResponse.json({ error: listResult.error.message }, { status });
    }

    allPatients.push(...listResult.data.patients);
    hasMore = page < listResult.data.pagination.totalPages;
    page++;
  }

  // 4. Process patients with segment tracking
  let updated = 0;
  let skipped = 0;

  const SEGMENTS = [
    { key: 'inactive_30', min: 30, max: 59, label: 'Inativo 30 dias' },
    { key: 'inactive_60', min: 60, max: 89, label: 'Inativo 60 dias' },
    { key: 'inactive_90', min: 90, max: 179, label: 'Inativo 90 dias' },
    { key: 'inactive_180', min: 180, max: 99999, label: 'Inativo 6 meses' },
  ];

  for (const patient of allPatients) {
    const daysSince = patient.lastVisit
      ? Math.floor((Date.now() - new Date(patient.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const segment = SEGMENTS.find(s => daysSince >= s.min && daysSince <= s.max);
    if (!segment) { skipped++; continue; }

    const reativarResult = await runAction(reativarPaciente, { patientId: patient.patientId }, ctx);
    if (!reativarResult.ok) {
      skipped++;
      continue;
    }
    updated++;
  }

  return NextResponse.json({ success: true, updated, errors: skipped });
}

// ─── Export ──────────────────────────────────────────────────────────────────

const wrappedGET = withModuleRoute('followup', moduleManifest)(handleGET);
const wrappedPOST = withModuleRoute('followup', moduleManifest)(handlePOST);

export { wrappedGET as GET, wrappedPOST as POST };
