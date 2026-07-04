import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listActivitiesByLead } from '../repositories/activities-repository';
import { listLeadsByClinic } from '../repositories/leads-repository';

export const listarNotificacoes = defineAction({
  name: 'comercial.listarNotificacoes',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Listar notificações de leads',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    const leads = await listLeadsByClinic(ctx.clinicId);
    const notifications: Array<Record<string, unknown>> = [];

    for (const lead of leads) {
      const activities = await listActivitiesByLead(lead.id);
      for (const act of activities) {
        if (act.activityType === 'hot_lead_notified') {
          const meta = (act.metadata ?? {}) as Record<string, unknown>;
          notifications.push({
            id: act.id,
            lead_id: lead.id,
            clinic_id: ctx.clinicId,
            type: 'hot_lead',
            channel: 'whatsapp',
            sent_at: act.createdAt?.toISOString?.() ?? act.createdAt,
            acknowledged: meta.acknowledged_at != null,
            lead_name: lead.name,
            lead_phone: lead.phoneNormalized || lead.phone,
            lead_score: lead.score,
            lead_source: lead.source,
            lead_interest: lead.interest,
          });
        }
      }
    }

    // Sort by sent_at descending
    notifications.sort((a, b) => {
      const da = new Date(a.sent_at as string).getTime();
      const db = new Date(b.sent_at as string).getTime();
      return db - da;
    });

    return { notifications, count: notifications.length };
  },
});
