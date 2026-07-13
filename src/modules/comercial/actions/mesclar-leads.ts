import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { mergeLeads } from '../repositories/leads-repository';
import { registerOwnerMerge } from '@/modules/crm';

export const mesclarLeads = defineAction({
  name: 'comercial.mesclarLeads',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Mesclar leads duplicados',
  input: z.object({
    winnerId: z.string().uuid(),
    loserId: z.string().uuid(),
    clinicId: z.string().uuid().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const success = await mergeLeads(
      input.winnerId,
      input.loserId,
      ctx.clinicId,
    );
    if (!success) throw new ActionError('not_found', 'Registros não encontrados.');
    return { success: true };
  },
});

// Register with the CRM execution coordinator at import time
registerOwnerMerge('lead', async (winnerId, loserId, clinicId) => {
  return mergeLeads(winnerId, loserId, clinicId);
});
