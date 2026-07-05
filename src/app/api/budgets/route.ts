/**
 * Budget API — legacy adapter.
 *
 * Thin wrapper over Financeiro module services.
 * Preserves { budgets } response shape for backward compatibility.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiAuth } from '@/lib/auth/session';
import { listBudgets, createBudget } from '@/modules/financeiro/services/budget-service';

/**
 * GET /api/budgets
 */
export async function GET(request: NextRequest) {
  const authResult = await validateApiAuth();
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
  }
  const clinicId = authResult.profile!.clinic_id;
  const budgets = await listBudgets(clinicId);
  return NextResponse.json({ budgets });
}

const legacyCreateBudgetSchema = z.object({
  patient_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  items: z.array(z.object({
    procedure_name: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
    unit_price: z.number().positive(),
    discount_percent: z.number().optional(),
    notes: z.string().optional(),
  })).min(1),
  discount_percent: z.number().min(0).max(100).optional(),
  valid_until: z.string().optional(),
});

/**
 * POST /api/budgets
 */
export async function POST(request: NextRequest) {
  const authResult = await validateApiAuth();
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status });
  }
  const clinicId = authResult.profile!.clinic_id;

  const rawBody = await request.json();
  const body = legacyCreateBudgetSchema.parse(rawBody);

  const budget = await createBudget({
    clinicId,
    patientId: body.patient_id,
    leadId: body.lead_id,
    title: body.title,
    description: body.description,
    discountPercent: body.discount_percent,
    validUntil: body.valid_until,
    items: body.items.map(item => ({
      procedureName: item.procedure_name,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountPercent: item.discount_percent,
      notes: item.notes,
    })),
  });

  return NextResponse.json({ budget }, { status: 201 });
}
