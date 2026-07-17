import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listarConsultas as scheduling } from '../services/scheduling-service';

export const listarConsultas = defineAction({
  name: 'operacional.listarConsultas',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar consultas',
  input: z.object({
    patientId: z.string().uuid().optional(),
    dentistId: z.string().uuid().optional(),
    status: z.string().optional(),
    date: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    dentistIds: z.array(z.string().uuid()).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    scheduling(ctx.clinicId, input),
});
