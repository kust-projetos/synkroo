/**
 * Campaigns Repository
 * Data access layer for campaigns using Drizzle
 */

import { eq, and, desc, sql, lte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { enqueueOutbox } from '@/lib/outbox/outbox-repository'
import { campaigns, campaignRecipients } from '@/lib/db/schema'
import { patients } from '@/modules/operacional/schema'
import { dbLogger } from '@/lib/logger'
// ─── Types ────────────────────────────────────────────────────

export type CampaignType = 'reactivation' | 'retention' | 'promotional' | 'follow_up'
export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'

export interface CampaignRow {
  id: string
  clinicId: string
  name: string
  description: string | null
  campaignType: string
  targetSegment: string | null
  messageTemplate: string
  channel: string
  status: string
  scheduledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  totalRecipients: number
  sentCount: number
  responseCount: number
  conversionCount: number
  optOutCount: number
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CampaignRecipientRow {
  id: string
  campaignId: string
  patientId: string
  status: string
  sentAt: Date | null
  deliveredAt: Date | null
  respondedAt: Date | null
  responseContent: string | null
  convertedAt: Date | null
  conversionAppointmentId: string | null
  errorMessage: string | null
  createdAt: Date
  patientPhone: string | null
  optOutMarketing: boolean
  optOutReminders: boolean
}

// ─── Create ───────────────────────────────────────────────────

export async function createCampaign(params: {
  clinicId: string
  name: string
  campaignType: string
  messageTemplate: string
  description?: string
  targetSegment?: string
  channel?: string
  scheduledAt?: Date
  createdBy?: string
}): Promise<CampaignRow | null> {
  const db = getDb()
  try {
    const [campaign] = await db
      .insert(campaigns)
      .values({
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
      })
      .returning()
    return campaign as CampaignRow
  } catch (error) {
    dbLogger.error('Error creating campaign', error)
    return null
  }
}

export async function addCampaignRecipients(params: {
  campaignId: string
  patientIds: string[]
}): Promise<number> {
  const db = getDb()
  try {
    const values = params.patientIds.map(patientId => ({
      campaignId: params.campaignId,
      patientId,
      status: 'pending',
    }))
    await db.insert(campaignRecipients).values(values)

    // Update total_recipients count
    await db
      .update(campaigns)
      .set({ totalRecipients: params.patientIds.length })
      .where(eq(campaigns.id, params.campaignId))

    return params.patientIds.length
  } catch (error) {
    dbLogger.error('Error adding campaign recipients', error)
    return 0
  }
}

export async function enqueueRecipientDelivery(params: {
  clinicId: string; campaignId: string; recipientId: string; patientId: string; phone: string; message: string;
}): Promise<void> {
  const db = getDb()
  await db.transaction(async (tx: any) => {
    await enqueueOutbox(tx, {
      clinicId: params.clinicId, operation: 'followup.campaign.recipient',
      businessKey: `${params.campaignId}:${params.recipientId}`,
      payload: params,
    })
  })
}



// ─── Read ─────────────────────────────────────────────────────

export async function findCampaignById(id: string): Promise<CampaignRow | null> {
  const db = getDb()
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .limit(1)
  return campaign as CampaignRow | null
}

export async function findScheduledCampaigns(clinicId: string, now = new Date()): Promise<CampaignRow[]> {
  const db = getDb()
  const rows = await db.select().from(campaigns).where(and(
    eq(campaigns.clinicId, clinicId),
    eq(campaigns.status, 'scheduled'),
    lte(campaigns.scheduledAt, now),
  ))
  return rows as CampaignRow[]
}

export async function findCampaignsByClinic(clinicId: string): Promise<CampaignRow[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.clinicId, clinicId))
    .orderBy(desc(campaigns.createdAt))
  return rows as CampaignRow[]
}

export async function findCampaignRecipients(campaignId: string): Promise<CampaignRecipientRow[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
  return rows as CampaignRecipientRow[]
}

export async function findPendingRecipients(campaignId: string): Promise<CampaignRecipientRow[]> {
  const db = getDb()
  const rows = await db
    .select({
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
    })
    .from(campaignRecipients)
    .innerJoin(patients, eq(patients.id, campaignRecipients.patientId))
    .where(and(
      eq(campaignRecipients.campaignId, campaignId),
      eq(campaignRecipients.status, 'pending')
    ))
  return rows as CampaignRecipientRow[]
}

export async function countCampaignRecipients(campaignId: string): Promise<number> {
  const db = getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(eq(campaignRecipients.campaignId, campaignId))
  return row?.count ?? 0
}

// ─── Update ───────────────────────────────────────────────────

export async function updateCampaignStatus(id: string, status: string): Promise<CampaignRow | null> {
  const db = getDb()
  const updateData: Record<string, unknown> = { status, updatedAt: new Date() }

  if (status === 'running' || status === 'started') {
    updateData.startedAt = new Date()
  }
  if (status === 'completed') {
    updateData.completedAt = new Date()
  }

  const [campaign] = await db
    .update(campaigns)
    .set(updateData as any)
    .where(eq(campaigns.id, id))
    .returning()
  return campaign as CampaignRow | null
}

export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string
    description: string | null
    campaignType: string
    targetSegment: string | null
    messageTemplate: string
    status: string
    scheduledAt: Date | null
  }>
): Promise<CampaignRow | null> {
  const db = getDb()
  const [campaign] = await db
    .update(campaigns)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning()
  return campaign as CampaignRow | null
}

export async function updateCampaignCounts(id: string): Promise<void> {
  const db = getDb()

  const [sentCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), sql`sent_at IS NOT NULL`))

  const [responseCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), sql`responded_at IS NOT NULL`))

  const [conversionCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), sql`converted_at IS NOT NULL`))

  const [pendingCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, id), eq(campaignRecipients.status, 'pending')))

  await db
    .update(campaigns)
    .set({
      sentCount: sentCountRow?.count ?? 0,
      responseCount: responseCountRow?.count ?? 0,
      conversionCount: conversionCountRow?.count ?? 0,
      ...(pendingCountRow?.count === 0 ? { status: 'completed', completedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, 'running')))
}

export async function updateRecipientStatus(
  id: string,
  data: Partial<{
    status: string
    sentAt: Date | null
    deliveredAt: Date | null
    respondedAt: Date | null
    responseContent: string | null
    convertedAt: Date | null
    conversionAppointmentId: string | null
    errorMessage: string | null
  }>
): Promise<CampaignRecipientRow | null> {
  const db = getDb()
  const [recipient] = await db
    .update(campaignRecipients)
    .set(data as any)
    .where(eq(campaignRecipients.id, id))
    .returning()
  return recipient as CampaignRecipientRow | null
}

export async function markRecipientSuppressed(id: string, reason: string): Promise<CampaignRecipientRow | null> {
  return updateRecipientStatus(id, { status: 'opted_out', errorMessage: reason })
}

export async function markRecipientSent(id: string): Promise<CampaignRecipientRow | null> {
  return updateRecipientStatus(id, { status: 'sent', sentAt: new Date() })
}

export async function markRecipientDelivered(id: string): Promise<CampaignRecipientRow | null> {
  return updateRecipientStatus(id, { status: 'delivered', deliveredAt: new Date() })
}

export async function markRecipientResponded(id: string, content: string): Promise<CampaignRecipientRow | null> {
  return updateRecipientStatus(id, { status: 'responded', respondedAt: new Date(), responseContent: content })
}

export async function markRecipientConverted(id: string, appointmentId?: string): Promise<CampaignRecipientRow | null> {
  return updateRecipientStatus(id, {
    status: 'converted',
    convertedAt: new Date(),
    conversionAppointmentId: appointmentId ?? null,
  })
}

export async function markRecipientError(id: string, errorMessage: string): Promise<CampaignRecipientRow | null> {
  return updateRecipientStatus(id, { status: 'failed', errorMessage })
}