import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { dismissSuggestion } from '../services/duplicate-review-service';

export const dispensarSugestaoDuplicidade = defineAction({
  name: 'crm.dispensarSugestaoDuplicidade',
  module: 'crm',
  requires: 'crm:review_duplicates',
  label: 'Dispensar sugestão de duplicidade',
  input: z.object({
    id: z.string().uuid(),
    dismissReason: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    dismissSuggestion(input.id, input.dismissReason ?? 'manual_dismiss', ctx),
});
