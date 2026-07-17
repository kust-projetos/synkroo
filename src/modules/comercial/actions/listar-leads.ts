import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listLeadsByClinic } from '../repositories/leads-repository';

export const listarLeads = defineAction({
  name: 'comercial.listarLeads',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Listar leads',
  input: z.object({
    clinicId: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const rows = await listLeadsByClinic(input.clinicId);
    return { leads: rows, total: rows.length };
  },
});
