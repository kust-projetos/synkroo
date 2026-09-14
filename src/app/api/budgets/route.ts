/**
 * Budget API — legacy adapter (T5 strangler).
 * Delegates to Financeiro Actions, preserves { budgets } / { budget } snake_case shape,
 * adds Deprecation/Link/X-Synkroo-Legacy-Route and telemetry without PII.
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleCanonicalAction } from '@/lib/api/action-route';
import { legacyCreateBudgetSchema } from '@/lib/validations/budget';
import { listarOrcamentos } from '@/modules/financeiro/actions/listar-orcamentos';
import { criarOrcamento } from '@/modules/financeiro/actions/criar-orcamento';
import { logger } from '@/lib/logger';

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

/**
 * GET /api/budgets — legacy
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const input: any = {
    status: url.searchParams.get('status') ?? undefined,
    patientId: url.searchParams.get('patientId') ?? url.searchParams.get('patient_id') ?? undefined,
    page: url.searchParams.get('page') ? parseInt(url.searchParams.get('page')!, 10) : undefined,
    limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined,
  };
  const canonical = await handleCanonicalAction(request, listarOrcamentos, input);
  const body: any = await canonical.clone().json().catch(() => ({}));
  let res: NextResponse;
  if (canonical.ok && body.data) {
    const budgets = (body.data as any[]).map(toLegacyBudget);
    // Preserve legacy shape { budgets } with snake_case, but keep x-request-id from canonical
    res = NextResponse.json({ budgets }, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
  } else {
    // For errors, translate canonical { error: { code, message, requestId } } to legacy { error: message } but keep status and requestId
    const legacyBody = body.error ? { error: body.error.message ?? body.error } : body;
    res = NextResponse.json(legacyBody, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
  }
  return legacyHeaders(res, 'GET /api/budgets');
}

/**
 * POST /api/budgets — legacy
 * Validação via `legacyCreateBudgetSchema` (src/lib/validations/budget.ts, D3).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => ({}));
  let parsed: any;
  try {
    parsed = legacyCreateBudgetSchema.parse(rawBody);
  } catch (e) {
    // Let canonical handle invalid_input via Action validation, but we pre-validate snake_case
    const canonical = await handleCanonicalAction(request, criarOrcamento, rawBody);
    const body: any = await canonical.clone().json().catch(() => ({}));
    const res = NextResponse.json(body.error ? { error: body.error.message ?? body.error } : body, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
    return legacyHeaders(res, 'POST /api/budgets');
  }

  const input = {
    patientId: parsed.patient_id,
    leadId: parsed.lead_id,
    title: parsed.title,
    description: parsed.description,
    discountPercent: parsed.discount_percent,
    validUntil: parsed.valid_until,
    items: parsed.items.map((item: any) => ({
      procedureName: item.procedure_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      notes: item.notes,
    })),
  };

  const canonical = await handleCanonicalAction(request, criarOrcamento, input);
  const body: any = await canonical.clone().json().catch(() => ({}));
  let res: NextResponse;
  if (canonical.ok && body.data) {
    res = NextResponse.json({ budget: toLegacyBudget(body.data) }, { status: 201 });
    const rid = canonical.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
  } else {
    const legacyBody = body.error ? { error: body.error.message ?? body.error } : body;
    res = NextResponse.json(legacyBody, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
  }
  return legacyHeaders(res, 'POST /api/budgets');
}
