import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listOverdueCharges, enrichOverdueCharges } from '../services/collection-service';

export const obterDashboard = defineAction({
  name: 'financeiro.obterDashboard',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter dashboard',
  input: z.object({
    clinicId: z.string().uuid(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const overdue = await listOverdueCharges(input.clinicId);
    const enriched = enrichOverdueCharges(overdue);
    const totalOverdue = enriched.reduce((sum, c) => sum + parseFloat(c.amount), 0);

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
