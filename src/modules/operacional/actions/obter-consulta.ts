import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '@/repositories/appointments';

export const obterConsulta = defineAction({
  name: 'operacional.obterConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Obter consulta por ID',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    const appointment = await repo.findByIdWithJoins(input.id, ctx.clinicId);
    if (!appointment) throw new ActionError('not_found', 'Agendamento não encontrado.');
    return { appointment };
  },
});
