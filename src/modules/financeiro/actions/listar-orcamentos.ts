import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const listarOrcamentos = defineAction({
  name: 'financeiro.listarOrcamentos',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar orçamentos',
  input: z.object({
    clinicId: z.string().uuid(),
    status: z.string().optional(),
    patientId: z.string().uuid().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(50),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet implemented');
  },
});
