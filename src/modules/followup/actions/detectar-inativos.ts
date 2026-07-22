import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/inactive-service';

export const detectarInativos = defineAction({
  name: 'followup.detectarInativos',
  module: 'followup',
  requires: 'followup:manage_followups',
  label: 'Detectar pacientes inativos',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    return service.runInactivityDetection(ctx.clinicId);
  },
});
