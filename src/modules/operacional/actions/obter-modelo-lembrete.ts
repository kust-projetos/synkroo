import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { buildReminderTemplate } from '../services/reminders-service';

export const obterModeloLembrete = defineAction({
  name: 'operacional.obterModeloLembrete',
  module: 'operacional',
  requires: 'operacional:manage_reminders',
  label: 'Obter modelo de lembrete',
  input: z.object({
    id: z.string().uuid(),
    mode: z.enum(['preview', 'template']).default('template'),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await buildReminderTemplate(input.id, ctx.clinicId, input.mode);
    if (!result) throw new ActionError('not_found', 'Agendamento não encontrado.');
    return result;
  },
});
