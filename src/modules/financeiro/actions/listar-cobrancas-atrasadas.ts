import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

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
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
