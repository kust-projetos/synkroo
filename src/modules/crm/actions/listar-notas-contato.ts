import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { listContactNotesService } from '../services/contact-notes-service';

export const listarNotasContato = defineAction({
  name: 'crm.listarNotasContato',
  module: 'crm',
  requires: 'crm:view',
  label: 'Listar notas do contato (lead: activity_type=note)',
  input: z.object({
    type: z.enum(['patient', 'lead']),
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    if (input.type !== 'patient' && input.type !== 'lead') {
      throw new ActionError('not_found', 'Contato não encontrado.');
    }
    return listContactNotesService(ctx, input.type, input.id);
  },
});