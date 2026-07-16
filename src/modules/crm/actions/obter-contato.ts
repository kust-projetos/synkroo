import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { getContactService } from '../services/contact-detail-service';

export const obterContato = defineAction({
  name: 'crm.obterContato',
  module: 'crm',
  requires: 'crm:view',
  label: 'Obter contato unificado (patient | lead)',
  input: z.object({
    type: z.enum(['patient', 'lead']),
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const contact = await getContactService(ctx, input.type, input.id);
    if (!contact) {
      throw new ActionError('not_found', 'Contato não encontrado.');
    }
    return contact;
  },
});