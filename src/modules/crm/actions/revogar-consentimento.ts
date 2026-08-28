import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getDb } from '@/lib/db/client';
import { consents } from '@/lib/db/schema/infra';
import { eq, and } from 'drizzle-orm';

export const revogarConsentimento = defineAction({
  name: 'crm.revogarConsentimento',
  module: 'crm',
  requires: 'lgpd:manage_consents',
  label: 'Revogar consentimento',
  input: z.object({
    consentId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = ctx.clinicId;
    const db = getDb();
    const [existing] = await db.select().from(consents).where(and(eq(consents.id, input.consentId), eq(consents.clinicId, clinicId))).limit(1);
    if (!existing) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Consentimento não encontrado.');
    const [row] = await db.update(consents).set({ granted: false, revokedAt: new Date() } as any).where(and(eq(consents.id, input.consentId), eq(consents.clinicId, clinicId))).returning();
    return row;
  },
});
