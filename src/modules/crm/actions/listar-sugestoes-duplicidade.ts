import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listSuggestions } from '../repositories/duplicate-suggestions-repository';

export const listarSugestoesDuplicidade = defineAction({
  name: 'crm.listarSugestoesDuplicidade',
  module: 'crm',
  requires: 'crm:review_duplicates',
  label: 'Listar sugestões de duplicidade',
  input: z.object({
    status: z.string().optional(),
    ownerType: z.enum(['patient', 'lead']).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const rows = await listSuggestions(ctx.clinicId, {
      status: input.status,
      ownerType: input.ownerType,
      limit: input.limit,
      offset: input.offset,
    });
    return { data: rows };
  },
});
