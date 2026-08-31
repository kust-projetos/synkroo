import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { consents } from '@/modules/crm/schema/contacts';

export type ConsentContactType = 'patient' | 'lead';

export async function hasActiveConsent(
  clinicId: string,
  contactId: string,
  contactType: ConsentContactType,
  purpose: string,
): Promise<boolean> {
  const [row] = await getDb().select({ id: consents.id }).from(consents).where(and(
    eq(consents.clinicId, clinicId),
    eq(consents.contactId, contactId),
    eq(consents.contactType, contactType),
    eq(consents.purpose, purpose),
    eq(consents.granted, true),
  )).limit(1);
  return Boolean(row);
}
