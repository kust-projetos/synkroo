/**
 * Leads Repository
 * Data access layer for leads using Drizzle
 */

import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { leads, leadActivities, pipelineStages } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────

export type LeadSource = 'whatsapp' | 'instagram' | 'web' | 'referral' | 'campaign' | 'other'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'converted' | 'lost'
export type LeadTemperature = 'cold' | 'warm' | 'hot'

export interface LeadRow {
  id: string
  clinicId: string
  patientId: string | null
  name: string
  phone: string
  email: string | null
  source: string
  campaignId: string | null
  score: number
  temperature: string
  status: string
  interest: string | null
  hasBudget: boolean | null
  hasTimeline: boolean | null
  assignedTo: string | null
  lastContactAt: Date | null
  nextFollowupAt: Date | null
  contactCount: number
  convertedAt: Date | null
  convertedAppointmentId: string | null
  lostReason: string | null
  lostAt: Date | null
  notes: string | null
  stageId: string | null
  sourceType: string | null
  dealValue: string | null
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface LeadWithCount {
  leads: LeadRow[]
  total: number
}

export interface LeadStats {
  total: number
  byStatus: Record<string, number>
  byTemperature: Record<string, number>
  conversionRate: number
  avgScore: number
}

// ─── Create ────────────────────────────────────────────────────

export async function createLead(params: {
  clinicId: string
  name: string
  phone: string
  email?: string
  source?: string
  interest?: string
  patientId?: string
  notes?: string
  dealValue?: number
  score?: number
  temperature?: string
  stageId?: string
}): Promise<LeadRow | null> {
  const db = getDb()
  try {
    const [lead] = await db
      .insert(leads)
      .values({
        clinicId: params.clinicId,
        name: params.name,
        phone: params.phone,
        email: params.email ?? null,
        source: params.source ?? 'other',
        patientId: params.patientId ?? null,
        interest: params.interest ?? null,
        notes: params.notes ?? null,
        score: params.score ?? 0,
        temperature: params.temperature ?? 'cold',
        stageId: params.stageId ?? null,
        dealValue: params.dealValue?.toString() ?? '0',
      })
      .returning()
    return lead as LeadRow
  } catch (error) {
    dbLogger.error('Error creating lead', error)
    return null
  }
}

export async function findLeadByPhone(phone: string, clinicId: string): Promise<LeadRow | null> {
  const db = getDb()
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.phone, phone), eq(leads.clinicId, clinicId)))
    .limit(1)
  return lead as LeadRow | null
}

// ─── Read ─────────────────────────────────────────────────────

export async function findLeads(params: {
  clinicId: string
  status?: string
  temperature?: string
  minScore?: number
  assignedTo?: string
  limit?: number
  offset?: number
}): Promise<LeadWithCount> {
  const db = getDb()
  const limit = params.limit ?? 50
  const offset = params.offset ?? 0

  const conditions = [eq(leads.clinicId, params.clinicId)]
  if (params.status) conditions.push(eq(leads.status, params.status))
  if (params.temperature) conditions.push(eq(leads.temperature, params.temperature))
  if (params.minScore !== undefined) conditions.push(gte(leads.score, params.minScore))
  if (params.assignedTo) conditions.push(eq(leads.assignedTo, params.assignedTo))

  const rows = await db
    .select()
    .from(leads)
    .where(and(...conditions))
    .orderBy(desc(leads.score))
    .limit(limit)
    .offset(offset)

  // Get total count
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(and(...conditions))

  return {
    leads: rows as LeadRow[],
    total: countRow?.count ?? 0,
  }
}

export async function findLeadById(id: string): Promise<LeadRow | null> {
  const db = getDb()
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, id))
    .limit(1)
  return lead as LeadRow | null
}

export async function findHotLeads(clinicId: string, limit: number = 10): Promise<LeadRow[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.clinicId, clinicId),
      eq(leads.temperature, 'hot'),
    ))
    .orderBy(desc(leads.score))
    .limit(limit)
  return rows as LeadRow[]
}

export async function getLeadStats(clinicId: string): Promise<LeadStats> {
  const db = getDb()
  const rows = await db
    .select({ status: leads.status, temperature: leads.temperature, score: leads.score })
    .from(leads)
    .where(eq(leads.clinicId, clinicId))

  const byStatus: Record<string, number> = {}
  const byTemperature: Record<string, number> = {}
  let totalScore = 0
  let converted = 0

  for (const lead of rows) {
    const status = lead.status ?? 'new'
    const temp = lead.temperature ?? 'cold'
    byStatus[status] = (byStatus[status] ?? 0) + 1
    byTemperature[temp] = (byTemperature[temp] ?? 0) + 1
    totalScore += lead.score ?? 0
    if (status === 'converted') converted++
  }

  const total = rows.length

  return {
    total,
    byStatus,
    byTemperature,
    conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
    avgScore: total > 0 ? Math.round(totalScore / total) : 0,
  }
}

// ─── Update ────────────────────────────────────────────────────

export async function updateLead(
  id: string,
  data: Partial<{
    name: string
    phone: string
    email: string | null
    status: string
    temperature: string
    score: number
    interest: string | null
    hasBudget: boolean | null
    hasTimeline: boolean | null
    assignedTo: string | null
    lastContactAt: Date | null
    nextFollowupAt: Date | null
    contactCount: number
    convertedAt: Date | null
    patientId: string | null
    notes: string | null
    dealValue: string | null
    stageId: string | null
    lostReason: string | null
    lostAt: Date | null
  }>
): Promise<LeadRow | null> {
  const db = getDb()
  const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() }

  try {
    const [lead] = await db
      .update(leads)
      .set(updateData as any)
      .where(eq(leads.id, id))
      .returning()
    return lead as LeadRow | null
  } catch (error) {
    dbLogger.error('Error updating lead', error)
    return null
  }
}

export async function updateLeadStatus(
  id: string,
  status: string,
  notes?: string
): Promise<LeadRow | null> {
  const updateData: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }

  if (status === 'converted') {
    updateData.convertedAt = new Date()
  }
  if (notes) {
    updateData.notes = notes
  }

  const db = getDb()
  const [lead] = await db
    .update(leads)
    .set(updateData as any)
    .where(eq(leads.id, id))
    .returning()
  return lead as LeadRow | null
}

export async function updateLeadScore(id: string, score: number, temperature: string): Promise<LeadRow | null> {
  const db = getDb()
  const [lead] = await db
    .update(leads)
    .set({ score, temperature, updatedAt: new Date() })
    .where(eq(leads.id, id))
    .returning()
  return lead as LeadRow | null
}

export async function updateLeadLastContact(id: string, score?: number): Promise<LeadRow | null> {
  const db = getDb()
  const updateData: Record<string, unknown> = {
    lastContactAt: new Date(),
    updatedAt: new Date(),
  }
  if (score !== undefined) updateData.score = score

  const [lead] = await db
    .update(leads)
    .set(updateData as any)
    .where(eq(leads.id, id))
    .returning()
  return lead as LeadRow | null
}

export async function convertLeadToPatient(leadId: string, patientId: string): Promise<LeadRow | null> {
  const db = getDb()
  const [lead] = await db
    .update(leads)
    .set({
      patientId,
      status: 'converted',
      convertedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(leads.id, leadId))
    .returning()
  return lead as LeadRow | null
}

// ─── Lead Activities ──────────────────────────────────────────

export async function createLeadActivity(params: {
  leadId: string
  activityType: string
  description?: string
  performedBy?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const db = getDb()
  await db
    .insert(leadActivities)
    .values({
      leadId: params.leadId,
      activityType: params.activityType,
      description: params.description ?? null,
      performedBy: params.performedBy ?? null,
      metadata: params.metadata ?? {},
    })
}

export async function getLeadActivities(leadId: string, limit: number = 50): Promise<unknown[]> {
  const db = getDb()
  return db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.leadId, leadId))
    .orderBy(desc(leadActivities.performedAt))
    .limit(limit)
}

// ─── Pipeline Stages ───────────────────────────────────────────

export async function getDefaultStageId(clinicId: string): Promise<string | null> {
  const db = getDb()
  const [stage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.clinicId, clinicId), eq(pipelineStages.isDefault, true)))
    .limit(1)
  return stage?.id ?? null
}