import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { updateContactTagsService } from '../services/contact-tags-service';

export const atualizarTagsContato = defineAction({
  name: 'crm.atualizarTagsContato',
  module: 'crm',
  requires: 'crm:manage_tags',
  label: 'Atualizar tags do contato (via owner bridge)',
  input: z.object({
    type: z.enum(['patient', 'lead']),
    id: z.string().uuid(),
    tags: z.array(z.string()).default([]),
  }),
  handler: async (input, ctx: ActionContext) => {
    if (input.type !== 'patient' && input.type !== 'lead') {
      throw new ActionError('not_found', 'Contato não encontrado.');
    }
    return updateContactTagsService(ctx, input.type, input.id, input.tags);
  },
});