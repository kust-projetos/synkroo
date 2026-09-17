import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { remarcarConsulta as scheduling } from '../services/scheduling-service';

export const remarcarConsulta = defineAction({
  name: 'operacional.remarcarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Remarcar consulta',
  // Etapa 5.3: audit schedule mutation (ADR-BASE-12).
  auditFields: ['id', 'scheduledAt', 'durationMinutes'],
  input: z.object({
    id: z.string().uuid(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().positive().default(30),
  }),
  handler: async (input, ctx: ActionContext) =>
    scheduling({ clinicId: ctx.clinicId, ...input }),
});
