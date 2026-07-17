import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { triggerManualReminder } from '../services/reminders-service';

export const gatilhoLembrete = defineAction({
  name: 'operacional.gatilhoLembrete',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Gatilhar lembrete manual',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    const result = await triggerManualReminder(input.id, ctx.clinicId);
    if (!result) throw new ActionError('not_found', 'Agendamento não encontrado.');
    return result;
  },
});
