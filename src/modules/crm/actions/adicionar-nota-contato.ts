import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { addContactNoteService } from '../services/contact-notes-service';

export const adicionarNotaContato = defineAction({
  name: 'crm.adicionarNotaContato',
  module: 'crm',
  requires: 'crm:manage_notes',
  label: 'Adicionar nota ao contato (via owner bridge)',
  sensitiveFields: ['content'],
  input: z.object({
    type: z.enum(['patient', 'lead']),
    id: z.string().uuid(),
    content: z.string().min(1),
  }),
  handler: async (input, ctx: ActionContext) => {
    if (input.type !== 'patient' && input.type !== 'lead') {
      throw new ActionError('not_found', 'Contato não encontrado.');
    }
    return addContactNoteService(ctx, input.type, input.id, input.content);
  },
});