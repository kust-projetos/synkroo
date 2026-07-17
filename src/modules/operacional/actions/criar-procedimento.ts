import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { criarProcedimento as service } from '../services/catalog-service';

export const criarProcedimento = defineAction({
  name: 'operacional.criarProcedimento',
  module: 'operacional',
  requires: 'operacional:manage_catalog',
  label: 'Criar procedimento',
  input: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    price: z.string().optional(),
    category: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    service({ clinicId: ctx.clinicId, ...input }),
});
