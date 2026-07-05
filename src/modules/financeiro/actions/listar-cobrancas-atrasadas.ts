import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listOverdueCharges, enrichOverdueCharges } from '../services/collection-service';

export const listarCobrancasAtrasadas = defineAction({
  name: 'financeiro.listarCobrancasAtrasadas',
  module: 'financeiro',
  requires: 'financeiro:manage_collections',
  label: 'Listar cobranças atrasadas',
  input: z.object({
    clinicId: z.string().uuid(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const charges = await listOverdueCharges(input.clinicId);
    const enriched = enrichOverdueCharges(charges);

    const start = (input.page - 1) * input.limit;
    const paged = enriched.slice(start, start + input.limit);

    return {
      data: paged,
      total: enriched.length,
      page: input.page,
      limit: input.limit,
    };
  },
});
