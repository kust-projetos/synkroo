import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listWaitlist } from '../repositories/waitlist-repository';

export const listarWaitlist = defineAction({
  name: 'operacional.listarWaitlist',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar waitlist',
  input: z.object({
    date: z.string().optional(),
    status: z.string().optional(),
    patientId: z.string().uuid().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    listWaitlist(ctx.clinicId, input),
});
