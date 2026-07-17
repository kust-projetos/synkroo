import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import {
  detectIncompleteTreatments,
  getIncompleteTreatmentAlerts,
} from '@/services/appointments/incomplete-treatment.service';

export const listarTratamentosIncompletos = defineAction({
  name: 'operacional.listarTratamentosIncompletos',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar tratamentos incompletos',
  input: z.object({
    alertsOnly: z.boolean().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    if (input.alertsOnly) {
      const alerts = await getIncompleteTreatmentAlerts(ctx.clinicId);
      return { alerts };
    }
    const treatments = await detectIncompleteTreatments(ctx.clinicId);
    return { treatments };
  },
});
