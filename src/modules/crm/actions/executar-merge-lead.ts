import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { executeMerge } from '../services/duplicate-execution-service';

export const executarMergeLead = defineAction({
  name: 'crm.executarMergeLead',
  module: 'crm',
  requires: 'crm:merge_leads',
  label: 'Executar merge de leads',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) =>
    executeMerge(input.id, 'lead', ctx),
});
