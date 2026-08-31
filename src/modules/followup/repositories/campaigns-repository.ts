import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { enqueueOutbox } from '@/lib/outbox/outbox-repository';
import { campaigns, campaignRecipients } from '@/modules/followup/schema/campaigns';
import { patients } from '@/modules/operacional/schema/patients';
import { dbLogger } from '@/lib/logger';

export type CampaignRow = typeof campaigns.$inferSelect;
export type CampaignRecipientRow = typeof campaignRecipients.$inferSelect & {
  patientPhone: string | null;
  optOutMarketing: boolean | null;
  optOutReminders: boolean | null;
};

export async function createCampaign(params: {
  clinicId: string;
  name: string;
  campaignType: string;
  messageTemplate: string;
  description?: string;
  targetSegment?: string;
  channel?: string;
  scheduledAt?: Date;
  createdBy?: string;
}): Promise<CampaignRow | null> {
  try {
    const [row] = await getDb().insert(campaigns).values({
      clinicId: params.clinicId,
      name: params.name,
      campaignType: params.campaignType,
      messageTemplate: params.messageTemplate,
      description: params.description ?? null,
      targetSegment: params.targetSegment ?? null,
      channel: params.channel ?? 'whatsapp',
      scheduledAt: params.scheduledAt ?? null,
      createdBy: params.createdBy ?? null,
      status: params.scheduledAt ? 'scheduled' : 'draft',
    }).returning();
    return row ?? null;
  } catch (error) {
    dbLogger.error('Error creating campaign', error);
    return null;
  }
}

export async function addCampaignRecipients(params: { campaignId: string; patientIds: string[] }): Promise<number> {
  if (!params.patientIds.length) return 0;
  try {
    await getDb().insert(campaignRecipients).values(params.patientIds.map((patientId) => ({
      campaignId: params.campaignId,
      patientId,
      status: 'pending',
    })));
    await getDb().update(campaigns).set({ totalRecipients: params.patientIds.length })
      .where(eq(campaigns.id, params.campaignId));
    return params.patientIds.length;
  } catch (error) {
    dbLogger.error('Error adding campaign recipients', error);
    return 0;
  }
}

export async function enqueueRecipientDelivery(params: {
  clinicId: string;
  campaignId: string;
  recipientId: string;
  patientId: string;
  phone: string;
  message: string;
}): Promise<void> {
  await getDb().transaction((tx) => enqueueOutbox(tx, {
    clinicId: params.clinicId,
    operation: 'followup.campaign.recipient',
    businessKey: `${params.campaignId}:${params.recipientId}`,
    payload: params,
  }));
}

export async function findCampaignById(id: string): Promise<CampaignRow | null> {
  const [row] = await getDb().select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

export async function findScheduledCampaigns(clinicId: string, now = new Date()): Promise<CampaignRow[]> {
  return getDb().select().from(campaigns).where(and(
    eq(campaigns.clinicId, clinicId),
    eq(campaigns.status, 'scheduled'),
    lte(campaigns.scheduledAt, now),
  ));
}

export async function findCampaignsByClinic(clinicId: string): Promise<CampaignRow[]> {
  return getDb().select().from(campaigns)
    .where(eq(campaigns.clinicId, clinicId)).orderBy(desc(campaigns.createdAt));
}

export async function findPendingRecipients(campaignId: string): Promise<CampaignRecipientRow[]> {
  const rows = await getDb().select({
    id: campaignRecipients.id,
    campaignId: campaignRecipients.campaignId,
    patientId: campaignRecipients.patientId,
    status: campaignRecipients.status,
    sentAt: campaignRecipients.sentAt,
    deliveredAt: campaignRecipients.deliveredAt,
    respondedAt: campaignRecipients.respondedAt,
    responseContent: campaignRecipients.responseContent,
    convertedAt: campaignRecipients.convertedAt,
    conversionAppointmentId: campaignRecipients.conversionAppointmentId,
    errorMessage: campaignRecipients.errorMessage,
    createdAt: campaignRecipients.createdAt,
    patientPhone: patients.phone,
    optOutMarketing: patients.optOutMarketing,
    optOutReminders: patients.optOutReminders,
  }).from(campaignRecipients).innerJoin(patients, eq(patients.id, campaignRecipients.patientId)).where(and(
    eq(campaignRecipients.campaignId, campaignId),
    eq(campaignRecipients.status, 'pending'),
  ));
  return rows as CampaignRecipientRow[];
}

export async function findCampaignDispatchState(id: string) {
  const [row] = await getDb().select({
    id: campaignRecipients.id,
    campaignId: campaignRecipients.campaignId,
    patientId: campaignRecipients.patientId,
    clinicId: campaigns.clinicId,
    status: campaignRecipients.status,
    patientPhone: patients.phone,
    optOutMarketing: patients.optOutMarketing,
    optOutReminders: patients.optOutReminders,
  }).from(campaignRecipients)
    .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
    .innerJoin(patients, eq(patients.id, campaignRecipients.patientId))
    .where(eq(campaignRecipients.id, id)).limit(1);
  return row ?? null;
}

export async function updateCampaignStatus(id: string, status: string): Promise<CampaignRow | null> {
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === 'running' || status === 'started') updateData.startedAt = new Date();
  if (status === 'completed' || status === 'failed' || status === 'partial') updateData.completedAt = new Date();
  const [row] = await getDb().update(campaigns).set(updateData as any).where(eq(campaigns.id, id)).returning();
  return row ?? null;
}

export async function updateCampaignCounts(id: string): Promise<void> {
  const db = getDb();
  const [sent] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), sql`sent_at IS NOT NULL`));
  const [responses] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), sql`responded_at IS NOT NULL`));
  const [conversions] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), sql`converted_at IS NOT NULL`));
  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, id));
  const [failed] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), eq(campaignRecipients.status, 'failed')));
  const [pending] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), eq(campaignRecipients.status, 'pending')));
  const terminalStatus = failed.count === total.count && total.count > 0 ? 'failed' : failed.count > 0 ? 'partial' : 'completed';
  await db.update(campaigns).set({
    sentCount: sent.count,
    responseCount: responses.count,
    conversionCount: conversions.count,
    ...(pending.count === 0 ? { status: terminalStatus, completedAt: new Date() } : {}),
    updatedAt: new Date(),
  }).where(and(eq(campaigns.id, id), eq(campaigns.status, 'running')));
}

export async function updateRecipientStatus(id: string, data: Record<string, unknown>) {
  const [row] = await getDb().update(campaignRecipients).set(data as any)
    .where(eq(campaignRecipients.id, id)).returning();
  return row ?? null;
}

export function markRecipientSuppressed(id: string, reason: string) {
  return updateRecipientStatus(id, { status: 'opted_out', errorMessage: reason });
}

export function markRecipientSent(id: string) {
  return updateRecipientStatus(id, { status: 'sent', sentAt: new Date() });
}

export function markRecipientError(id: string, errorMessage: string) {
  return updateRecipientStatus(id, { status: 'failed', errorMessage });
}
