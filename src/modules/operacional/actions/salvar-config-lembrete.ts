import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { upsertReminderConfig } from '../repositories/reminders-repository';

export const salvarConfigLembrete = defineAction({
  name: 'operacional.salvarConfigLembrete',
  module: 'operacional',
  requires: 'operacional:manage_reminders',
  label: 'Salvar configuração de lembrete',
  input: z.object({
    procedureTypeId: z.string().uuid(),
    hoursBefore: z.number().int().positive(),
    messageTemplate: z.string().min(1),
    enabled: z.boolean(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const config = await upsertReminderConfig(ctx.clinicId, input);
    return { id: config.id };
  },
});
