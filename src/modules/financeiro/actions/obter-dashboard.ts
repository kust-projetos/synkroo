import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listOverdueCharges, enrichOverdueCharges } from '../services/collection-service';
import { toCents } from '../services/money';

export const obterDashboard = defineAction({
  name: 'financeiro.obterDashboard',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter dashboard',
  input: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const overdue = await listOverdueCharges(ctx.clinicId);
    const enriched = enrichOverdueCharges(overdue);
    // Soma em centavos bigint — sem aritmética de ponto flutuante no total.
    const totalOverdueCents = enriched.reduce((sum, c) => sum + toCents(c.amount ?? '0'), 0n);
    const totalOverdue = Number(totalOverdueCents) / 100;

    return {
      overdueCount: enriched.length,
      totalOverdue,
      overdueStages: {
        light: enriched.filter(c => c.collectionStage === 'light').length,
        firm: enriched.filter(c => c.collectionStage === 'firm').length,
        internal: enriched.filter(c => c.collectionStage === 'internal').length,
      },
    };
  },
});
