import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { consultarDisponibilidade as availabilityService } from '../services/availability-service';

export const consultarDisponibilidade = defineAction({
  name: 'operacional.consultarDisponibilidade',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Consultar disponibilidade',
  input: z.object({
    dentistId: z.string().uuid(),
    date: z.string(), // 'YYYY-MM-DD'
    slotMinutes: z.number().int().positive().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    availabilityService({ clinicId: ctx.clinicId, ...input }),
});
