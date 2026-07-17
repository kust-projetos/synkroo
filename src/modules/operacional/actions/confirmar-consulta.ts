import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { confirmarConsulta as scheduling } from '../services/scheduling-service';

export const confirmarConsulta = defineAction({
  name: 'operacional.confirmarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Confirmar consulta',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) =>
    scheduling({ clinicId: ctx.clinicId, id: input.id }),
});
