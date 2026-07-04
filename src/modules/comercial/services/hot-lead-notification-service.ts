/**
 * Comercial module — hot lead notification service.
 *
 * Resolves recipients and dispatches notifications via
 * atendimento.enviarMensagemDireta (not sendWhatsAppMessage).
 *
 * Recipient resolution:
 * 1. Lead's assigned user (if active and has phone)
 * 2. First active Owner/Admin user with phone
 * 3. Fallback: create commercial task + log skip
 */

import { runAction } from '@/core/actions/run';
import { buildSystemContext } from '@/core/actions/context';
import { listLeadsByClinic } from '../repositories/leads-repository';
import { createTask } from '../repositories/tasks-repository';
import { insertActivity } from '../repositories/activities-repository';
import { dbLogger } from '@/lib/logger';
import { listActivitiesByLead } from '../repositories/activities-repository';
import { enviarMensagemDireta } from '@/modules/atendimento/actions';
import { listClinicUsers } from '@/modules/core/actions';

async function findRecipientPhone(clinicId: string, assignedTo?: string | null): Promise<string | null> {
  const ctx = await buildSystemContext(clinicId);

  // 1. Try assigned user
  if (assignedTo) {
    const userResult = await runAction(listClinicUsers, {}, ctx);
    if (userResult.ok) {
      const users = (userResult.data as unknown as { users: Array<{ id: string; phone: string | null; isActive: boolean }> }).users;
      const assigned = users.find((u: { id: string; phone: string | null; isActive: boolean }) => u.id === assignedTo && u.isActive && u.phone);
      if (assigned?.phone) return assigned.phone;
    }
  }

  // 2. Fallback: find first active Owner/Admin with phone
  const usersResult = await runAction(listClinicUsers, {}, ctx);
  if (usersResult.ok) {
    const users = (usersResult.data as unknown as { users: Array<{ id: string; role: string; phone: string | null; isActive: boolean }> }).users;
    const admin = users.find((u: { role: string; isActive: boolean; phone: string | null }) => (u.role === 'owner' || u.role === 'admin') && u.isActive && u.phone);
    if (admin?.phone) return admin.phone;
  }

  return null;
}

async function hasRecentNotification(leadId: string): Promise<boolean> {
  const activities = await listActivitiesByLead(leadId);
  const recent = activities.find((a) => {
    if (a.activityType !== 'hot_lead_notified') return false;
    const diff = Date.now() - new Date(a.createdAt!).getTime();
    return diff < 24 * 60 * 60 * 1000; // 24h
  });
  return !!recent;
}

export interface HotNotificationResult {
  notified: number;
  skipped: number;
}

export async function processarNotificacoesLeadsQuentesHandler(input: {
  clinicId: string;
}): Promise<HotNotificationResult> {
  const { clinicId } = input;
  const leads = await listLeadsByClinic(clinicId);
  const ctx = await buildSystemContext(clinicId);

  let notified = 0;
  let skipped = 0;

  const hotLeads = leads.filter(
    (l) => l.temperature === 'hot' && (l.score || 0) >= 70 && l.status !== 'converted' && l.status !== 'lost',
  );

  for (const lead of hotLeads) {
    // Check 24h dedup
    if (await hasRecentNotification(lead.id)) {
      skipped++;
      continue;
    }

    const phone = await findRecipientPhone(clinicId, lead.assignedTo);

    if (!phone) {
      // No recipient: create task + log
      await createTask({
        clinicId,
        leadId: lead.id,
        title: `Lead quente sem notificação: ${lead.name}`,
        description: `Lead ${lead.name} (score: ${lead.score}) não teve notificador disponível.`,
        priority: 'high',
      });
      await insertActivity({
        leadId: lead.id,
        activityType: 'hot_lead_notification_skipped',
        description: 'No recipient available for hot lead notification',
        metadata: { score: lead.score },
      });
      dbLogger.info('hot_lead_notification_skipped', { leadId: lead.id, clinicId });
      skipped++;
      continue;
    }

    // Send notification via atendimento.enviarMensagemDireta
    const msg = `🔥 Lead quente! ${lead.name} (${lead.score}pts). Fonte: ${lead.source}`;
    const result = await runAction(enviarMensagemDireta, {
      channel: 'whatsapp',
      externalId: phone,
      message: msg,
    }, ctx);

    if (result.ok) {
      await insertActivity({
        leadId: lead.id,
        activityType: 'hot_lead_notified',
        description: `Notified via WhatsApp to ${phone}`,
        metadata: { phone, score: lead.score },
      });
      notified++;
    } else {
      dbLogger.error('hot_lead_notification_failed', { leadId: lead.id, error: result.error });
      skipped++;
    }
  }

  return { notified, skipped };
}
