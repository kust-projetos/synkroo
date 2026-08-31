/**
 * Budget Installments API — legacy adapter (T5 strangler).
 * Delegates to Financeiro Actions, preserves { installments, remaining_balance } snake_case,
 * adds Deprecation/Link/X-Synkroo-Legacy-Route and telemetry without PII.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleCanonicalAction } from '@/lib/api/action-route';
import { listarParcelas } from '@/modules/financeiro/actions/listar-parcelas';
import { salvarParcelas } from '@/modules/financeiro/actions/salvar-parcelas';
import { atualizarParcela } from '@/modules/financeiro/actions/atualizar-parcela';
import { deletarParcela } from '@/modules/financeiro/actions/deletar-parcela';
import { logger } from '@/lib/logger';

function legacyHeaders(res: NextResponse, route: string): NextResponse {
  res.headers.set('Deprecation', 'true');
  res.headers.set('Link', '</api/financeiro/budgets>; rel="successor-version"');
  res.headers.set('X-Synkroo-Legacy-Route', '1');
  logger.info('legacy route request', { legacyRoute: route });
  return res;
}

type RouteParams = { params: Promise<{ id: string }> };

function withRequestId(res: NextResponse, canonical: NextResponse): NextResponse {
  res.headers.set('x-request-id', canonical.headers.get('x-request-id') ?? '');
  return res;
}

function legacyErrorBody(body: any): unknown {
  return { error: body.error?.message ?? 'Erro interno' };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const canonical = await handleCanonicalAction(request, listarParcelas, { budgetId: id });
  const body: any = await canonical.clone().json();
  let res: NextResponse;
  if (canonical.ok && body.data) {
    const installments = body.data;
    const remaining = body.meta?.remaining_balance ?? 0;
    res = NextResponse.json({ installments, remaining_balance: remaining }, { status: canonical.status });
  } else {
    res = NextResponse.json(legacyErrorBody(body), { status: canonical.status });
  }
  return legacyHeaders(withRequestId(res, canonical), 'GET /api/budgets/[id]/installments');
}

const createInstallmentsSchema = z.object({
  installments: z.array(
    z.object({ amount: z.number().positive(), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  ).min(1),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  let parsed: any;
  try {
    parsed = createInstallmentsSchema.parse(await request.json());
  } catch (e) {
    // Contrato legado: entrada inválida no POST retorna 400 (sem delegar à Action)
    const res = NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    const rid = request.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
    return legacyHeaders(res, 'POST /api/budgets/[id]/installments');
  }
  const installments = parsed.installments.map((i: any) => ({ amount: i.amount, dueDate: i.due_date }));
  const canonical = await handleCanonicalAction(request, salvarParcelas, { budgetId: id, installments });
  const body: any = await canonical.clone().json();
  let res: NextResponse;
  if (canonical.ok) {
    const data = body.data ?? body;
    res = NextResponse.json({ installments: Array.isArray(data) ? data : [] }, { status: 201 });
  } else {
    res = NextResponse.json(legacyErrorBody(body), { status: canonical.status });
  }
  return legacyHeaders(withRequestId(res, canonical), 'POST /api/budgets/[id]/installments');
}

const updateInstallmentSchema = z.object({
  amount: z.number().positive().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: budgetId } = await params;
  const { searchParams } = new URL(request.url);
  const installmentId = searchParams.get('installment_id');
  if (!installmentId) {
    const res = NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });
    return legacyHeaders(res, 'PATCH /api/budgets/[id]/installments');
  }
  let parsed: any;
  try {
    parsed = updateInstallmentSchema.parse(await request.json());
  } catch (e) {
    // Contrato legado: entrada inválida no PATCH retorna 400 (sem delegar à Action)
    const res = NextResponse.json({ error: 'Validation failed' }, { status: 400 });
    const rid = request.headers.get('x-request-id');
    if (rid) res.headers.set('x-request-id', rid);
    return legacyHeaders(res, 'PATCH /api/budgets/[id]/installments');
  }
  const input: any = { budgetId, installmentId };
  if (parsed.amount !== undefined) input.amount = parsed.amount;
  if (parsed.due_date !== undefined) input.dueDate = parsed.due_date;
  const canonical = await handleCanonicalAction(request, atualizarParcela, input);
  const body: any = await canonical.clone().json();
  let res: NextResponse;
  if (canonical.ok && body.data) {
    res = NextResponse.json({ installment: body.data }, { status: canonical.status });
  } else {
    res = NextResponse.json(legacyErrorBody(body), { status: canonical.status });
  }
  return legacyHeaders(withRequestId(res, canonical), 'PATCH /api/budgets/[id]/installments');
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: budgetId } = await params;
  const { searchParams } = new URL(request.url);
  const installmentId = searchParams.get('installment_id');
  if (!installmentId) {
    const res = NextResponse.json({ error: 'installment_id query parameter is required' }, { status: 400 });
    return legacyHeaders(res, 'DELETE /api/budgets/[id]/installments');
  }
  const canonical = await handleCanonicalAction(request, deletarParcela, { budgetId, installmentId });
  const body: any = await canonical.clone().json();
  let res: NextResponse;
  if (canonical.ok) {
    res = NextResponse.json({ success: true }, { status: canonical.status });
  } else {
    res = NextResponse.json(legacyErrorBody(body), { status: canonical.status });
  }
  return legacyHeaders(withRequestId(res, canonical), 'DELETE /api/budgets/[id]/installments');
}