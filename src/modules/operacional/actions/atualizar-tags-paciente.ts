import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { patients } from '@/modules/operacional/schema';
import { findById } from '../repositories/patients-repository';

/**
 * Trim whitespace, drop empty strings, dedup case-insensitively preserving
 * first occurrence.
 */
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Owner-bridge CRM → operacional: atualiza as tags do paciente com
 * normalização (trim + dedup case-insensitive preservando a primeira
 * ocorrência) e predicate ownerId+clinicId.
 */
export const atualizarTagsPaciente = defineAction({
  name: 'operacional.atualizarTagsPaciente',
  module: 'operacional',
  requires: 'operacional:manage_patients',
  label: 'Atualizar tags do paciente',
  input: z.object({
    patientId: z.string().uuid(),
    tags: z.array(z.string()).default([]),
  }),
  handler: async (input, ctx: ActionContext) => {
    const patient = await findById(ctx.clinicId, input.patientId);
    if (!patient) {
      throw new ActionError('not_found', 'Paciente não encontrado.');
    }
    const tags = normalizeTags(input.tags);
    const db = getDb();
    const [updated] = await (db
      .update(patients)
      .set({ tags: tags as any, updatedAt: new Date() })
      .where(and(eq(patients.id, input.patientId), eq(patients.clinicId, ctx.clinicId))) as any)
      .returning({ id: patients.id });
    if (!updated) {
      throw new ActionError('not_found', 'Paciente não encontrado.');
    }
    return { id: updated.id, tags };
  },
});