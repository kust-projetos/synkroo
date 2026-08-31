/**
 * CRM public seam — tenant-safe consent ports. Actions remain the only
 * request entrypoint; these functions carry the trusted clinic and actor.
 */
export type ConsentContactType = 'patient' | 'lead';

export interface ConsentPortInput {
  contactId: string;
  contactType: ConsentContactType;
  purpose: string;
  channel?: string;
  version?: string;
  notes?: string | null;
  actorUserId: string | null;
}

async function contactExists(clinicId: string, contactId: string, contactType: ConsentContactType) {
  const { getDb } = await import('@/lib/db/client');
  const db = getDb();
  if (contactType === 'patient') {
    const { patients } = await import('@/modules/operacional/schema/patients');
    const { and, eq } = await import('drizzle-orm');
    const [row] = await db.select({ id: patients.id }).from(patients).where(and(
      eq(patients.id, contactId),
      eq(patients.clinicId, clinicId),
    )).limit(1);
    return Boolean(row);
  }

  const { leads } = await import('@/modules/comercial/schema/leads');
  const { and, eq } = await import('drizzle-orm');
  const [row] = await db.select({ id: leads.id }).from(leads).where(and(
    eq(leads.id, contactId),
    eq(leads.clinicId, clinicId),
  )).limit(1);
  return Boolean(row);
}

export async function listConsentsForClinic(
  clinicId: string,
  opts?: { contactId?: string; contactType?: ConsentContactType },
) {
  const { getDb } = await import('@/lib/db/client');
  const { consents } = await import('@/modules/crm/schema/contacts');
  const { eq, and } = await import('drizzle-orm');
  const conditions = [eq(consents.clinicId, clinicId)];
  if (opts?.contactId) conditions.push(eq(consents.contactId, opts.contactId));
  if (opts?.contactType) conditions.push(eq(consents.contactType, opts.contactType));
  return getDb().select().from(consents).where(and(...conditions));
}

export async function listConsentsForContact(
  clinicId: string,
  contactId: string,
  contactType: ConsentContactType,
) {
  if (!(await contactExists(clinicId, contactId, contactType))) return null;
  return listConsentsForClinic(clinicId, { contactId, contactType });
}

export async function grantConsentForContact(clinicId: string, input: ConsentPortInput) {
  if (!(await contactExists(clinicId, input.contactId, input.contactType))) return null;
  const { getDb } = await import('@/lib/db/client');
  const { consents } = await import('@/modules/crm/schema/contacts');
  const now = new Date();
  const [row] = await getDb().insert(consents).values({
    clinicId,
    contactId: input.contactId,
    contactType: input.contactType,
    purpose: input.purpose,
    granted: true,
    grantedAt: now,
    revokedAt: null,
    channel: input.channel ?? 'web',
    version: input.version ?? '1',
    actor: input.actorUserId,
    notes: input.notes ?? null,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [consents.clinicId, consents.contactId, consents.contactType, consents.purpose],
    set: {
      granted: true,
      grantedAt: now,
      revokedAt: null,
      channel: input.channel ?? 'web',
      version: input.version ?? '1',
      actor: input.actorUserId,
      notes: input.notes ?? null,
      updatedAt: now,
    },
  }).returning();
  return row;
}

export async function revokeConsentForContact(
  clinicId: string,
  input: ConsentPortInput,
) {
  if (!(await contactExists(clinicId, input.contactId, input.contactType))) return null;
  const { getDb } = await import('@/lib/db/client');
  const { consents } = await import('@/modules/crm/schema/contacts');
  const { and, eq } = await import('drizzle-orm');
  const [row] = await getDb().update(consents).set({
    granted: false,
    revokedAt: new Date(),
    channel: input.channel ?? 'web',
    notes: input.notes ?? null,
    actor: input.actorUserId,
    updatedAt: new Date(),
  }).where(and(
    eq(consents.clinicId, clinicId),
    eq(consents.contactId, input.contactId),
    eq(consents.contactType, input.contactType),
    eq(consents.purpose, input.purpose),
  )).returning();
  return row ?? null;
}

export async function revokeConsentById(
  clinicId: string,
  consentId: string,
  actorUserId: string | null,
) {
  const { getDb } = await import('@/lib/db/client');
  const { consents } = await import('@/modules/crm/schema/contacts');
  const { and, eq } = await import('drizzle-orm');
  const [existing] = await getDb().select().from(consents).where(and(
    eq(consents.id, consentId),
    eq(consents.clinicId, clinicId),
  )).limit(1);
  if (!existing) return null;
  if (!(await contactExists(clinicId, existing.contactId, existing.contactType as ConsentContactType))) return null;
  const [row] = await getDb().update(consents).set({
    granted: false,
    revokedAt: new Date(),
    actor: actorUserId,
    updatedAt: new Date(),
  }).where(and(eq(consents.id, consentId), eq(consents.clinicId, clinicId))).returning();
  return row ?? null;
}
