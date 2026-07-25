import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { listContactTimelineService } from '../services/contact-timeline-service';

export const listarTimelineContato = defineAction({
  name: 'crm.listarTimelineContato',
  module: 'crm',
  requires: 'crm:view',
  label: 'Listar timeline do contato (DESC)',
  input: z.object({
    type: z.enum(['patient', 'lead']),
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    if (input.type !== 'patient' && input.type !== 'lead') {
      throw new ActionError('not_found', 'Contato não encontrado.');
    }
    return listContactTimelineService(ctx, input.type, input.id);
  },
});