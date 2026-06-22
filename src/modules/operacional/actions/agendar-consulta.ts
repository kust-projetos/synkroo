import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { agendarConsulta as scheduling } from '../services/scheduling-service';

export const agendarConsulta = defineAction({
  name: 'operacional.agendarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Agendar consulta',
  input: z.object({
    patientId: z.string().uuid(),
    dentistId: z.string().uuid().optional(),
    procedureId: z.string().uuid().optional(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().positive().default(30),
    notes: z.string().max(1000).optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    scheduling({ clinicId: ctx.clinicId, ...input }),
});
