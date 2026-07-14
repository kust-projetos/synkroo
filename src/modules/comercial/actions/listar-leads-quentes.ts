import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listLeadsByClinic } from '../repositories/leads-repository';

// Minimal inferred shape for the hot-lead filter callback (TS7006).
interface LeadRow {
  temperature?: string | null;
  score?: number | null;
  status?: string | null;
}

export const listarLeadsQuentes = defineAction({
  name: 'comercial.listarLeadsQuentes',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Listar leads quentes',
  input: z.object({
    limit: z.number().int().min(1).max(100).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const rows = await listLeadsByClinic(ctx.clinicId);
    const limit = input.limit ?? 10;
    const hotLeads = rows
      .filter((l: LeadRow) => l.temperature === 'hot' && (l.score || 0) >= 70 && l.status !== 'converted' && l.status !== 'lost')
      .slice(0, limit);

    return {
      leads: hotLeads,
      count: hotLeads.length,
      timestamp: new Date().toISOString(),
    };
  },
});
