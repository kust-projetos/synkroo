import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listLeadsByClinic } from '../repositories/leads-repository';

export const obterEstatisticasLeads = defineAction({
  name: 'comercial.obterEstatisticasLeads',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Obter estatísticas de leads',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    const rows = await listLeadsByClinic(ctx.clinicId);
    const total = rows.length;
    const byStatus: Record<string, number> = {};
    const byTemperature: Record<string, number> = {};
    let hotCount = 0;
    let totalScore = 0;

    for (const l of rows) {
      const s = l.status || 'unknown';
      const t = l.temperature || 'cold';
      byStatus[s] = (byStatus[s] || 0) + 1;
      byTemperature[t] = (byTemperature[t] || 0) + 1;
      if (t === 'hot') hotCount++;
      totalScore += l.score || 0;
    }

    return {
      stats: {
        total,
        byStatus,
        byTemperature,
        hotLeads: hotCount,
        avgScore: rows.length > 0 ? Math.round(totalScore / rows.length) : 0,
      },
    };
  },
});
