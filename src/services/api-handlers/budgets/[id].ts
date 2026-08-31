/**
 * Budget Detail API — legacy adapter (T5 strangler).
 * Delegates to Financeiro Actions (tenant-scoped), preserves { budget } snake_case shape,
 * adds Deprecation/Link/X-Synkroo-Legacy-Route and telemetry without PII.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleCanonicalAction } from '@/lib/api/action-route';
import { obterOrcamento } from '@/modules/financeiro/actions/obter-orcamento';
import { atualizarOrcamento } from '@/modules/financeiro/actions/atualizar-orcamento';
import { arquivarOrcamento } from '@/modules/financeiro/actions/arquivar-orcamento';
import { logger } from '@/lib/logger';

type RouteParams = { params: Promise<{ id: string }> };

function legacyHeaders(res: NextResponse, route: string): NextResponse {
  res.headers.set('Deprecation', 'true');
  res.headers.set('Link', '</api/financeiro/budgets>; rel="successor-version"');
  res.headers.set('X-Synkroo-Legacy-Route', '1');
  logger.info('legacy route request', { legacyRoute: route });
  return res;
}

function toLegacyBudget(b: any): any {
  if (!b || typeof b !== 'object') return b;
  return {
    id: b.id,
    clinic_id: b.clinicId ?? b.clinic_id,
    patient_id: b.patientId ?? b.patient_id,
    title: b.title,
    description: b.description,
    status: b.status,
    total_value: b.totalValue ?? b.total_value,
    final_value: b.finalValue ?? b.final_value,
    created_at: b.createdAt ?? b.created_at,
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const canonical = await handleCanonicalAction(request, obterOrcamento, { id });
  const body: any = await canonical.clone().json().catch(() => ({}));
  let res: NextResponse;
  if (canonical.ok && body.data) {
    res = NextResponse.json({ budget: toLegacyBudget(body.data) }, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
  } else {
    const legacyBody = body.error ? { error: body.error.message ?? body.error } : body;
    res = NextResponse.json(legacyBody, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
  }
  return legacyHeaders(res, 'GET /api/budgets/[id]');
}

const updateBudgetSchema = z.object({
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  discount_percent: z.number().min(0).max(100).optional(),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  let parsed: any;
  try {
    parsed = updateBudgetSchema.parse(await request.json());
  } catch (e) {
    const canonical = await handleCanonicalAction(request, atualizarOrcamento, { id, ...(await request.json().catch(() => ({}))) });
    const body: any = await canonical.clone().json().catch(() => ({}));
    const res = NextResponse.json(body.error ? { error: body.error.message ?? body.error } : body, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
    return legacyHeaders(res, 'PUT /api/budgets/[id]');
  }

  const input: any = { id };
  if (parsed.title !== undefined) input.title = parsed.title;
  if (parsed.description !== undefined) input.description = parsed.description;
  if (parsed.status !== undefined) input.status = parsed.status;
  if (parsed.notes !== undefined) input.notes = parsed.notes;
  if (parsed.valid_until !== undefined) input.validUntil = parsed.valid_until;
  if (parsed.discount_percent !== undefined) input.discountPercent = parsed.discount_percent;

  const canonical = await handleCanonicalAction(request, atualizarOrcamento, input);
  const body: any = await canonical.clone().json().catch(() => ({}));
  let res: NextResponse;
  if (canonical.ok && body.data) {
    res = NextResponse.json({ budget: toLegacyBudget(body.data) }, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
  } else {
    const legacyBody = body.error ? { error: body.error.message ?? body.error } : body;
    res = NextResponse.json(legacyBody, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
  }
  return legacyHeaders(res, 'PUT /api/budgets/[id]');
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const canonical = await handleCanonicalAction(request, arquivarOrcamento, { id });
  const body: any = await canonical.clone().json().catch(() => ({}));
  let res: NextResponse;
  if (canonical.ok) {
    res = NextResponse.json({ success: true }, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
  } else {
    const legacyBody = body.error ? { error: body.error.message ?? body.error } : body;
    res = NextResponse.json(legacyBody, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
  }
  return legacyHeaders(res, 'DELETE /api/budgets/[id]');
}
