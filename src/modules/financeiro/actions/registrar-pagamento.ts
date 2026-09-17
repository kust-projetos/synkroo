import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { registerManualPayment } from '../services/payment-service';

export const registrarPagamento = defineAction({
  name: 'financeiro.registrarPagamento',
  module: 'financeiro',
  requires: 'financeiro:record_payment',
  label: 'Registrar pagamento',
  // Etapa 5.3: audit money mutation incl. idempotency key (ADR-BASE-12).
  // `notes` excluded — free text, no audit value.
  auditFields: ['budgetId', 'chargeId', 'amount', 'paymentMethod', 'paidAt', 'idempotencyKey'],
  input: z.object({
    budgetId: z.string().uuid(),
    chargeId: z.string().uuid().optional(),
    amount: z.number().positive(),
    paymentMethod: z.string().min(1),
    paidAt: z.string().optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().min(1).max(200).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = ctx.clinicId;
    const actorUserId = ctx.user?.id ?? null;
    const payment = await registerManualPayment({
      clinicId,
      budgetId: input.budgetId,
      chargeId: input.chargeId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      paidAt: input.paidAt,
      notes: input.notes,
      actorUserId,
      idempotencyKey: input.idempotencyKey,
    });
    return payment;
  },
});
