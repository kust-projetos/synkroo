import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

export const listarConversas = defineAction({
  name: 'atendimento.listarConversas',
  module: 'atendimento',
  requires: 'atendimento:view',
  label: 'Listar conversas',
  input: z.object({
    status: z.string().optional(),
    channel: z.enum(['whatsapp', 'instagram', 'web', 'telegram']).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const rows = await repo.findByClinic(ctx.clinicId, {
      status: input.status,
      channel: input.channel,
      page: input.page,
      limit: input.limit,
    });
    const total = await repo.countByClinic(ctx.clinicId, {
      status: input.status,
      channel: input.channel,
    });
    const limit = input.limit ?? 50;
    const page = input.page ?? 1;
    return { conversations: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },
});
