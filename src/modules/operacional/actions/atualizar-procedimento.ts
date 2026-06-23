import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { atualizarProcedimento as service } from '../services/catalog-service';

export const atualizarProcedimento = defineAction({
  name: 'operacional.atualizarProcedimento',
  module: 'operacional',
  requires: 'operacional:manage_catalog',
  label: 'Atualizar procedimento',
  input: z.object({
    id: z.string().uuid(),
    name: z.string().optional(),
    description: z.string().optional(),
    durationMinutes: z.number().int().positive().optional(),
    price: z.string().optional(),
    category: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    service(ctx.clinicId, input.id, input),
});
