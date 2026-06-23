import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '@/repositories/appointments';

export const reativarConsulta = defineAction({
  name: 'operacional.reativarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Reativar consulta cancelada',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    const appt = await repo.findById(input.id);
    if (!appt || appt.clinicId !== ctx.clinicId) throw new ActionError('not_found', 'Agendamento não encontrado.');
    if (appt.status !== 'cancelled') throw new ActionError('invalid_input', 'Apenas agendamentos cancelados podem ser reativados.');
    await repo.updateStatus(input.id, 'scheduled');
    return { success: true };
  },
});
