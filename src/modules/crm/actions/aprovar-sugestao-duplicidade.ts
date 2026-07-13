import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { approveSuggestion } from '../services/duplicate-review-service';

export const aprovarSugestaoDuplicidade = defineAction({
  name: 'crm.aprovarSugestaoDuplicidade',
  module: 'crm',
  requires: 'crm:review_duplicates',
  label: 'Aprovar sugestão de duplicidade',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) =>
    approveSuggestion(input.id, ctx),
});
