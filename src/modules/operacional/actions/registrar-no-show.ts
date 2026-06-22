import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { registrarNoShow as scheduling } from '../services/scheduling-service';

export const registrarNoShow = defineAction({
  name: 'operacional.registrarNoShow',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Registrar falta',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) =>
    scheduling({ clinicId: ctx.clinicId, id: input.id }),
});
