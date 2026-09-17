import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { cancelarConsulta as scheduling } from '../services/scheduling-service';

export const cancelarConsulta = defineAction({
  name: 'operacional.cancelarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Cancelar consulta',
  // Etapa 5.3: audit schedule mutation (ADR-BASE-12).
  auditFields: ['id', 'reason'],
  input: z.object({
    id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    scheduling({ clinicId: ctx.clinicId, ...input }),
});
