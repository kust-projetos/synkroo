import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getDb } from '@/lib/db/client';
import { consents } from '@/lib/db/schema/infra';
import { eq, and } from 'drizzle-orm';

export const concederConsentimento = defineAction({
  name: 'crm.concederConsentimento',
  module: 'crm',
  requires: 'lgpd:manage_consents',
  label: 'Conceder consentimento',
  input: z.object({
    patientId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    purpose: z.string().min(1),
  }).refine((d) => !!d.patientId || !!d.leadId, { message: 'patientId or leadId required' }),
  handler: async (input, ctx: ActionContext) => {
    const clinicId = ctx.clinicId;
    const actorUserId = ctx.user?.id ?? null;
    const db = getDb();
    // Validate ownership
    if (input.patientId) {
      const { patients } = await import('@/modules/operacional/schema/patients');
      const [p] = await db.select().from(patients).where(and(eq(patients.id, input.patientId), eq(patients.clinicId, clinicId))).limit(1);
      if (!p) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Paciente não encontrado.');
    }
    const [row] = await db.insert(consents).values({
      clinicId,
      patientId: input.patientId ?? null,
      leadId: input.leadId ?? null,
      purpose: input.purpose,
      granted: true,
      grantedAt: new Date(),
      grantedBy: actorUserId,
    } as any).returning();
    return row;
  },
});
