import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { executeMerge } from '../services/duplicate-execution-service';

export const executarMergePatient = defineAction({
  name: 'crm.executarMergePatient',
  module: 'crm',
  requires: 'crm:merge_patients',
  label: 'Executar merge de pacientes',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) =>
    executeMerge(input.id, 'patient', ctx),
});
