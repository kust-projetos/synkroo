/**
 * Budget Payments API — legacy adapter (T5 strangler).
 * Delegates to Financeiro Actions, preserves { payments } snake_case shape,
 * adds Deprecation/Link/X-Synkroo-Legacy-Route and telemetry without PII.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleCanonicalAction } from '@/lib/api/action-route';
import { listarPagamentos } from '@/modules/financeiro/actions/listar-pagamentos';
import { registrarPagamento } from '@/modules/financeiro/actions/registrar-pagamento';
import { logger } from '@/lib/logger';

function legacyHeaders(res: NextResponse, route: string): NextResponse {
  res.headers.set('Deprecation', 'true');
  res.headers.set('Link', '</api/financeiro/budgets>; rel="successor-version"');
  res.headers.set('X-Synkroo-Legacy-Route', '1');
  logger.info('legacy route request', { legacyRoute: route });
  return res;
}

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  payment_method: z.string().min(1),
  notes: z.string().optional(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const canonical = await handleCanonicalAction(request, listarPagamentos, { budgetId: id });
  const body: any = await canonical.clone().json().catch(() => ({}));
  let res: NextResponse;
  if (canonical.ok && body.data) {
    const payments = (body.data as any[]).map((p: any) => ({
      id: p.id,
      budget_id: p.budgetId ?? p.budget_id,
      amount: p.amount,
      payment_method: p.paymentMethod ?? p.payment_method,
      paid_at: p.paidAt ?? p.paid_at,
      notes: p.notes,
    }));
    res = NextResponse.json({ payments }, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
  } else {
    const legacyBody = body.error ? { error: body.error.message ?? body.error } : body;
    res = NextResponse.json(legacyBody, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
  }
  return legacyHeaders(res, 'GET /api/budgets/[id]/payments');
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  let parsed: any;
  try {
    parsed = recordPaymentSchema.parse(await request.json());
  } catch (e) {
    const canonical = await handleCanonicalAction(request, registrarPagamento, { budgetId: id, amount: 0, paymentMethod: '' });
    const body: any = await canonical.clone().json().catch(() => ({}));
    const res = NextResponse.json(body.error ? { error: body.error.message ?? body.error } : body, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
    return legacyHeaders(res, 'POST /api/budgets/[id]/payments');
  }
  const input = {
    budgetId: id,
    amount: parsed.amount,
    paymentMethod: parsed.payment_method,
    notes: parsed.notes,
  };
  const canonical = await handleCanonicalAction(request, registrarPagamento, input);
  const body: any = await canonical.clone().json().catch(() => ({}));
  let res: NextResponse;
  if (canonical.ok && body.data) {
    const p: any = body.data;
    const payment = {
      id: p.id,
      budget_id: p.budgetId ?? p.budget_id,
      amount: p.amount,
      payment_method: p.paymentMethod ?? p.payment_method,
      paid_at: p.paidAt ?? p.paid_at,
      notes: p.notes,
    };
    res = NextResponse.json({ payment, remaining_balance: null }, { status: 201 });
    const rid = canonical.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
  } else {
    const legacyBody = body.error ? { error: body.error.message ?? body.error } : body;
    res = NextResponse.json(legacyBody, { status: canonical.status });
    const rid = canonical.headers.get('x-request-id') || body.error?.requestId;
    if (rid) res.headers.set('x-request-id', rid);
  }
  return legacyHeaders(res, 'POST /api/budgets/[id]/payments');
}
