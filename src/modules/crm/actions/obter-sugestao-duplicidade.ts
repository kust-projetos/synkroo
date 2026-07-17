import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { performLightRefresh } from '../services/duplicate-review-service';

export const obterSugestaoDuplicidade = defineAction({
  name: 'crm.obterSugestaoDuplicidade',
  module: 'crm',
  requires: 'crm:review_duplicates',
  label: 'Obter sugestão de duplicidade com refresh leve',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await performLightRefresh(input.id, ctx.clinicId);
    if (!result.ok) throw result.error;
    return result.suggestion;
  },
});
