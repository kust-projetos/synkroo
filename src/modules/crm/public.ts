/**
 * CRM public seam — side-effect-free ports for cross-module composition (W5.1).
 * Only exposes tenant-safe behavior, never Actions internals.
 */
export async function listConsentsForClinic(clinicId: string, opts?: { contactId?: string; contactType?: string }) {
  const { getDb } = await import('@/lib/db/client');
  const { consents } = await import('@/lib/db/schema/infra');
  const { eq, and } = await import('drizzle-orm');
  const db = getDb();
  const conditions: any[] = [eq(consents.clinicId, clinicId)];
  if (opts?.contactId) conditions.push(eq(consents.contactId, opts.contactId as any));
  if (opts?.contactType) conditions.push(eq(consents.contactType, opts.contactType as any));
  return (db.select() as any).from(consents).where(and(...conditions));
}
