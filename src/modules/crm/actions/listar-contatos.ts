import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listContactsService } from '../services/contact-list-service';

export const listarContatos = defineAction({
  name: 'crm.listarContatos',
  module: 'crm',
  requires: 'crm:view',
  label: 'Listar contatos (pacientes + leads não convertidos)',
  input: z.object({
    search: z.string().optional(),
    type: z.enum(['patient', 'lead']).optional(),
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).default(0),
  }),
  handler: async (input, ctx: ActionContext) =>
    listContactsService(ctx, input),
});