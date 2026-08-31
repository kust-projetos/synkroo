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
    status: z.string().optional(),
    temperature: z.string().optional(),
    source: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const rows = await listLeadsByClinic(ctx.clinicId);
    return { leads: rows, total: rows.length };
  },
});
