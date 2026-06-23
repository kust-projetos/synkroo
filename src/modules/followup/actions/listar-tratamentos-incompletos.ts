import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/budget-followup-service';

export const listarTratamentosIncompletos = defineAction({
  name: 'followup.listarTratamentosIncompletos',
  module: 'followup',
  requires: 'followup:view',
  label: 'Listar tratamentos incompletos',
  input: z.object({
    alertsOnly: z.boolean().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return service.listarTratamentosIncompletos(ctx.clinicId, input.alertsOnly);
  },
});
