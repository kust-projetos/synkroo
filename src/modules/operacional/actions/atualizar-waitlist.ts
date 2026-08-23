import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { findWaitlistById, updateWaitlist } from '../repositories/waitlist-repository';

export const atualizarWaitlist = defineAction({
  name: 'operacional.atualizarWaitlist',
  module: 'operacional',
  requires: 'operacional:manage_waitlist',
  label: 'Atualizar entrada da waitlist',
  input: z.object({
    id: z.string().uuid(),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD').optional(),
    preferredTimeStart: z.string().optional(),
    preferredTimeEnd: z.string().optional(),
    dentistId: z.string().uuid().nullable().optional(),
    procedureId: z.string().uuid().nullable().optional(),
    priority: z.number().int().optional(),
    notes: z.string().nullable().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const entry = await findWaitlistById(input.id, ctx.clinicId);
    if (!entry) throw new ActionError('not_found', 'Entrada da waitlist não encontrada');

    if (entry.status === 'scheduled') {
      throw new ActionError('conflict', 'Não é possível alterar uma entrada já agendada');
    }

    if (input.preferredDate) {
      const today = new Date().toDateString();
      if (new Date(input.preferredDate) < new Date(today)) {
        throw new ActionError('invalid_input', 'preferredDate must be today or in the future');
      }
    }

    const { id, ...data } = input;
    const updated = await updateWaitlist(id, {
      ...data,
      preferredDate: data.preferredDate ? new Date(data.preferredDate + 'T00:00:00Z') : undefined,
    });

    if (!updated) {
      throw new ActionError('internal', 'Erro ao atualizar entrada da waitlist');
    }

    return { id: updated.id };
  },
});
