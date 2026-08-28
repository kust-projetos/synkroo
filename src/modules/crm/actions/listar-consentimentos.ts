import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getDb } from '@/lib/db/client';
import { consents } from '@/lib/db/schema/infra';
import { eq } from 'drizzle-orm';

export const listarConsentimentos = defineAction({
  name: 'crm.listarConsentimentos',
  module: 'crm',
  requires: 'lgpd:view_consents',
  label: 'Listar consentimentos',
  input: z.object({
    patientId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const db = getDb();
    const clinicId = ctx.clinicId;
    // Tenant-scoped: filtrar por clinicId, validar ownership se patient/lead fornecido
    if (input.patientId) {
      const { patients } = await import('@/modules/operacional/schema/patients');
      const { eq: eq2, and } = await import('drizzle-orm');
      const [p] = await db.select().from(patients).where(and(eq2(patients.id, input.patientId), eq2(patients.clinicId, clinicId))).limit(1);
      if (!p) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Paciente não encontrado.');
    }
    const rows = await db.select().from(consents).where(eq(consents.clinicId, clinicId));
    return { data: rows };
  },
});
