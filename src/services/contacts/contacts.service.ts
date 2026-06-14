/** Unified Contacts Service — migrated to Drizzle */
import { eq, or, ilike, and, arrayContains, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients, leads, pipelineStages, leadActivities, patientObservations } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'
import { getSession } from '@/lib/auth/session'
import type { Contact, ContactType, ContactListParams, ContactCreateInput, ContactUpdateInput, ContactNote, ContactListResponse } from './types'

// ─── Schema note: patients Drizzle lacks status/active columns present in Supabase.
// ─── We cast via `as any` where the column exists in DB but not in Drizzle schema.
const P = patients as any
const L = leads as any

function patientToContact(p: any): Contact {
  return {
    id: p.id, type: 'patient', clinic_id: p.clinicId ?? '', name: p.name, phone: p.phone ?? '',
    email: p.email ?? null, cpf: p.cpf ?? null, birth_date: p.birthDate ?? null,
    tags: p.tags ?? [], status: p.status ?? 'active', notes: p.notes ?? null,
    created_at: p.createdAt?.toISOString?.() ?? '', updated_at: p.updatedAt?.toISOString?.() ?? '',
  }
}

function leadToContact(l: any): Contact {
  return {
    id: l.id, type: 'lead', clinic_id: l.clinicId ?? '', name: l.name, phone: l.phone ?? '',
    email: l.email ?? null, cpf: null, birth_date: null, tags: l.tags ?? [],
    status: l.status ?? 'new', stage_id: l.stageId ?? null, score: l.score ?? null,
    temperature: l.temperature ?? null, source: l.source ?? null, interest: l.interest ?? null,
    patient_id: l.patientId ?? null, notes: l.notes ?? null,
    created_at: l.createdAt?.toISOString?.() ?? '', updated_at: l.updatedAt?.toISOString?.() ?? '',
  }
}

function searchClause(search: string, fields: any[]) {
  return or(...fields.map((f) => ilike(f, `%${search}%`)))
}

export async function searchContacts(clinicId: string, params: ContactListParams = {}): Promise<ContactListResponse> {
  const db = getDb()
  const { search, type = 'all', tags, status, page = 1, limit = 20 } = params
  const offset = (page - 1) * limit
  const contacts: Contact[] = []
  let total = 0

  try {
    if (type === 'patient' || type === 'all') {
      const conditions: any[] = [eq(P.clinicId, clinicId)]
      if (search) conditions.push(searchClause(search, [P.name, P.phone, P.email, P.cpf]))
      if (status) conditions.push(eq(P.status, status))
      if (tags?.length) conditions.push(arrayContains(P.tags, tags))

      const rows = await db.select().from(patients).where(and(...conditions)).offset(offset).limit(limit)
      contacts.push(...rows.map(patientToContact))
      total += rows.length
    }

    if (type === 'lead' || type === 'all') {
      const conditions: any[] = [eq(L.clinicId, clinicId)]
      if (search) conditions.push(searchClause(search, [L.name, L.phone, L.email]))
      if (status) conditions.push(eq(L.status, status))
      if (tags?.length) conditions.push(arrayContains(L.tags, tags))

      const rows = await db.select().from(leads).where(and(...conditions)).offset(offset).limit(limit)
      contacts.push(...rows.map(leadToContact))
      total += rows.length
    }

    contacts.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    return { data: contacts.slice(0, limit), total, page, limit }
  } catch (error) { dbLogger.error('Error searching contacts', error); throw error }
}

export async function getContactById(clinicId: string, contactId: string, contactType: ContactType): Promise<Contact | null> {
  const db = getDb()
  try {
    if (contactType === 'patient') {
      const [p] = await db.select().from(patients).where(and(eq(P.id, contactId), eq(P.clinicId, clinicId)))
      return p ? patientToContact(p) : null
    } else {
      const result = await db.select().from(leads).leftJoin(pipelineStages, eq(L.stageId, pipelineStages.id))
        .where(and(eq(L.id, contactId), eq(L.clinicId, clinicId)))
      const row = result[0] as any
      return row?.leads ? leadToContact(row.leads) : null
    }
  } catch (error) { dbLogger.error('Error getting contact by ID', error); return null }
}

export async function createContact(clinicId: string, input: ContactCreateInput): Promise<Contact> {
  const db = getDb()
  if (!input.name || !input.phone) throw new Error('Name and phone are required')

  try {
    if (input.type === 'patient') {
      const [p] = await db.insert(patients).values({
        clinicId, name: input.name, phone: input.phone, email: input.email ?? null,
        cpf: input.cpf ?? null, birthDate: input.birth_date ?? null,
        tags: input.tags ?? [], notes: input.notes ?? null, status: 'active',
      } as any).returning()
      return patientToContact(p)
    } else {
      const [defaultStage] = await db.select({ id: pipelineStages.id }).from(pipelineStages)
        .where(and(eq(pipelineStages.clinicId, clinicId), eq(pipelineStages.systemKey, 'new')))
        .limit(1)
      const [l] = await db.insert(leads).values({
        clinicId, name: input.name, phone: input.phone, email: input.email ?? null,
        source: input.source ?? null, interest: input.interest ?? null,
        tags: input.tags ?? [], notes: input.notes ?? null, status: 'new',
        stageId: defaultStage?.id ?? null,
      } as any).returning()
      return leadToContact(l)
    }
  } catch (error) { dbLogger.error('Error creating contact', error); throw error }
}

export async function updateContact(clinicId: string, contactId: string, contactType: ContactType, input: ContactUpdateInput): Promise<Contact> {
  const db = getDb()
  const set: any = { updatedAt: new Date() }
  const fieldMap: Record<string, string> = { name: 'name', phone: 'phone', email: 'email', cpf: 'cpf', birth_date: 'birthDate', tags: 'tags', notes: 'notes', status: 'status', interest: 'interest', score: 'score', temperature: 'temperature' }
  for (const [k, v] of Object.entries(fieldMap)) {
    if ((input as any)[k] !== undefined) set[v] = (input as any)[k]
  }

  try {
    if (contactType === 'patient') {
      const [p] = await db.update(patients).set(set).where(and(eq(P.id, contactId), eq(P.clinicId, clinicId))).returning()
      return patientToContact(p)
    } else {
      const [l] = await db.update(leads).set(set).where(and(eq(L.id, contactId), eq(L.clinicId, clinicId))).returning()
      return leadToContact(l)
    }
  } catch (error) { dbLogger.error('Error updating contact', error); throw error }
}

export async function archiveContact(clinicId: string, contactId: string, contactType: ContactType): Promise<Contact> {
  return updateContact(clinicId, contactId, contactType, { status: 'archived' })
}

export async function getContactNotes(clinicId: string, contactId: string, contactType: ContactType): Promise<ContactNote[]> {
  const db = getDb()
  try {
    if (contactType === 'lead') {
      const rows = await db.select().from(leadActivities)
        .where(and(eq(leadActivities.leadId as any, contactId), eq(leadActivities.activityType, 'note')))
        .orderBy(desc(leadActivities.performedAt))
      return rows.map((a: any) => ({ id: a.id, contact_id: a.leadId, contact_type: 'lead', content: a.description ?? '', created_at: a.performedAt?.toISOString?.() ?? '', created_by: a.performedBy ?? undefined }))
    } else {
      const rows = await db.select().from(patientObservations)
        .where(and(eq(patientObservations.patientId, contactId), eq(patientObservations.clinicId, clinicId)))
        .orderBy(desc(patientObservations.createdAt))
      return rows.map((o: any) => ({ id: o.id, contact_id: o.patientId, contact_type: 'patient', content: o.content ?? '', created_at: o.createdAt?.toISOString?.() ?? '', created_by: o.createdBy ?? undefined }))
    }
  } catch (error) { dbLogger.error('Error getting contact notes', error); throw error }
}

export async function addContactNote(clinicId: string, contactId: string, contactType: ContactType, content: string): Promise<ContactNote> {
  const db = getDb()
  const session = await getSession()
  const userId = session?.user?.id
  const now = new Date()

  try {
    if (contactType === 'lead') {
      const [a] = await db.insert(leadActivities).values({
        leadId: contactId, activityType: 'note', description: content, performedAt: now, performedBy: userId,
      } as any).returning()
      return { id: a.id, contact_id: a.leadId, contact_type: 'lead', content: a.description ?? '', created_at: a.performedAt?.toISOString?.() ?? '', created_by: a.performedBy ?? undefined }
    } else {
      const [o] = await db.insert(patientObservations).values({
        clinicId, patientId: contactId, content, createdBy: userId,
      }).returning()
      return { id: o.id, contact_id: o.patientId, contact_type: 'patient', content: o.content ?? '', created_at: o.createdAt?.toISOString?.() ?? '', created_by: o.createdBy ?? undefined }
    }
  } catch (error) { dbLogger.error('Error adding contact note', error); throw error }
}
