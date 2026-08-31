/**
 * Comercial module — hot lead notification service.
 *
 * Resolves recipients and enqueues notifications for Atendimento.
 *
 * Recipient resolution:
 * 1. Lead's assigned user (if active and has phone)
 * 2. First active Owner/Admin user with phone
 * 3. Fallback: create commercial task + log skip
 */

// Minimal inferred shape for the hot-lead filter callback (TS7006).
interface HotLeadRow {
  id: string;
  temperature?: string | null;
  score?: number | null;
  status?: string | null;
}

import { listLeadsByClinic } from '../repositories/leads-repository';
import { createTask } from '../repositories/tasks-repository';
import { insertActivity } from '../repositories/activities-repository';
import { dbLogger } from '@/lib/logger';
import { listActivitiesByLead } from '../repositories/activities-repository';
import { listClinicUsers } from '@/modules/core/public';
import { getDb } from '@/lib/db/client';
import { enqueueOutbox } from '@/lib/outbox/outbox-repository';
import { OUTBOX_OPERATIONS } from '@/lib/outbox/operations';

async function findRecipientPhone(clinicId: string, assignedTo?: string | null): Promise<string | null> {
  const users = await listClinicUsers(clinicId);

  // 1. Try assigned user
  if (assignedTo) {
    const assigned = users.find((user) => user.id === assignedTo && user.isActive && user.phone);
    if (assigned?.phone) return assigned.phone;
  }

  // 2. Fallback: find first active Owner/Admin with phone
  const admin = users.find((user) => {
    const role = (user.roleName ?? '').toLowerCase();
    return (role === 'owner' || role === 'admin' || role === 'administrador') && user.isActive && user.phone;
  });
  if (admin?.phone) return admin.phone;

  return null;
}

async function hasRecentNotification(leadId: string): Promise<boolean> {
  const activities = await listActivitiesByLead(leadId);
  const recent = activities.find((a) => {
    if (a.activityType !== 'hot_lead_notified' && a.activityType !== 'hot_lead_notification_queued') return false;
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

  let notified = 0;
  let skipped = 0;

  const hotLeads = leads.filter(
    (l: HotLeadRow) => l.temperature === 'hot' && (l.score || 0) >= 70 && l.status !== 'converted' && l.status !== 'lost',
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

    // Queue the external effect; Atendimento owns delivery.
    const msg = `🔥 Lead quente! ${lead.name} (${lead.score}pts). Fonte: ${lead.source}`;
    try {
      await getDb().transaction((tx) => enqueueOutbox(tx, {
        clinicId,
        operation: OUTBOX_OPERATIONS.ATENDIMENTO_OUTBOUND_MESSAGE,
        businessKey: `hot-lead:${lead.id}:${new Date().toISOString().slice(0, 10)}`,
        payload: {
          channel: 'whatsapp',
          externalId: phone,
          message: msg,
        },
      }));
      await insertActivity({
        leadId: lead.id,
        activityType: 'hot_lead_notification_queued',
        description: 'Hot lead notification queued for WhatsApp delivery',
        metadata: { score: lead.score },
      });
      notified++;
    } catch (error) {
      dbLogger.error('hot_lead_notification_queue_failed', { leadId: lead.id, error });
      skipped++;
    }
  }

  return { notified, skipped };
}
