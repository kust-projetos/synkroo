/**
 * Consent Service — migrated to Drizzle
 * LGPD-compliant consent management with automatic audit logging
 */

import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { consents } from '@/lib/db/schema/infra'
import { dbLogger } from '@/lib/logger'

export type ConsentPurpose = 'data_collection' | 'marketing' | 'whatsapp_communication'
export type ConsentChannel = 'web' | 'whatsapp' | 'manual'

export interface Consent {
  id: string
  clinic_id: string
  contact_id: string
  contact_type: 'patient' | 'lead'
  purpose: ConsentPurpose
  granted: boolean
  granted_at: string | null
  revoked_at: string | null
  channel: ConsentChannel | null
  version: string | null
  actor: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ConsentGrantInput {
  contact_id: string
  contact_type: 'patient' | 'lead'
  purpose: ConsentPurpose
  channel?: ConsentChannel
  version?: string
  actor?: string
  notes?: string
}

function toSnake(r: any): Consent {
  return {
    id: r.id,
    clinic_id: r.clinicId ?? '',
    contact_id: r.contactId ?? '',
    contact_type: r.contactType ?? 'patient',
    purpose: r.purpose ?? 'data_collection',
    granted: r.granted ?? false,
    granted_at: r.grantedAt?.toISOString?.() ?? null,
    revoked_at: r.revokedAt?.toISOString?.() ?? null,
    channel: r.channel ?? null,
    version: r.version ?? null,
    actor: r.actor ?? null,
    notes: r.notes ?? null,
    created_at: r.createdAt?.toISOString?.() ?? '',
    updated_at: r.updatedAt?.toISOString?.() ?? '',
  }
}

export async function getConsentsForContact(
  clinicId: string,
  contactId: string,
  contactType: 'patient' | 'lead',
): Promise<Consent[]> {
  const db = getDb()
  try {
    const rows = await db
      .select()
      .from(consents)
      .where(
        and(
          eq(consents.contactId, contactId),
          eq(consents.contactType, contactType),
          eq(consents.clinicId, clinicId),
        ),
      )
    return rows.map(toSnake)
  } catch (error) {
    dbLogger.error('Error getting consents for contact', error)
    throw error
  }
}

export async function grantConsent(
  clinicId: string,
  input: ConsentGrantInput,
): Promise<Consent> {
  const db = getDb()
  try {
    const now = new Date()
    const [row] = await db
      .insert(consents)
      .values({
        clinicId,
        contactId: input.contact_id,
        contactType: input.contact_type,
        purpose: input.purpose,
        granted: true,
        grantedAt: now,
        revokedAt: null as any,
        channel: (input.channel || 'web') as any,
        version: input.version || '1',
        actor: input.actor || null,
        notes: input.notes || null,
      })
      .onConflictDoUpdate({
        target: [consents.clinicId, consents.contactId, consents.contactType, consents.purpose],
        set: {
          granted: true,
          grantedAt: now,
          revokedAt: null as any,
          channel: (input.channel || 'web') as any,
          version: input.version || '1',
          actor: input.actor || null,
          notes: input.notes || null,
          updatedAt: now,
        },
      })
      .returning()
    return toSnake(row)
  } catch (error) {
    dbLogger.error('Error granting consent', error)
    throw error
  }
}

export async function hasActiveConsent(
  clinicId: string,
  contactId: string,
  contactType: 'patient' | 'lead',
  purpose: ConsentPurpose,
): Promise<boolean> {
  const [row] = await getDb().select({ id: consents.id })
    .from(consents)
    .where(and(
      eq(consents.clinicId, clinicId),
      eq(consents.contactId, contactId),
      eq(consents.contactType, contactType),
      eq(consents.purpose, purpose),
      eq(consents.granted, true),
    ))
    .limit(1)
  return Boolean(row)
}

export async function revokeConsent(
  clinicId: string,
  contactId: string,
  contactType: 'patient' | 'lead',
  purpose: ConsentPurpose,
  channel?: ConsentChannel,
  notes?: string,
): Promise<Consent> {
  const db = getDb()
  try {
    const now = new Date()
    const [row] = await db
      .update(consents)
      .set({
        granted: false,
        revokedAt: now,
        channel: (channel || 'web') as any,
        notes: notes || null,
        updatedAt: now,
      })
      .where(
        and(
          eq(consents.contactId, contactId),
          eq(consents.contactType, contactType),
          eq(consents.clinicId, clinicId),
          eq(consents.purpose, purpose),
        ),
      )
      .returning()
    return toSnake(row)
  } catch (error) {
    dbLogger.error('Error revoking consent', error)
    throw error
  }
}
