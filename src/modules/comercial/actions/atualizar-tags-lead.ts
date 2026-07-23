import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { findLeadByIdForClinic } from '../repositories/leads-repository';

/**
 * Trim whitespace, drop empty strings, dedup case-insensitively preserving
 * first occurrence.
 */
function normalizeLeadTags(tags: string[]): string[] {
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
 * Owner-bridge CRM → comercial: atualiza as tags do lead com normalização
 * (trim + dedup case-insensitive preservando a primeira ocorrência)
 * e predicate ownerId+clinicId.
 */
export const atualizarTagsLead = defineAction({
  name: 'comercial.atualizarTagsLead',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Atualizar tags do lead',
  input: z.object({
    leadId: z.string().uuid(),
    tags: z.array(z.string()).default([]),
  }),
  handler: async (input, ctx: ActionContext) => {
    const lead = await findLeadByIdForClinic(input.leadId, ctx.clinicId);
    if (!lead) {
      throw new ActionError('not_found', 'Lead não encontrado.');
    }
    const tags = normalizeLeadTags(input.tags);
    const db = getDb();
    const [updated] = await (db
      .update(leads)
      .set({ tags: tags as any, updatedAt: new Date() })
      .where(and(eq(leads.id, input.leadId), eq(leads.clinicId, ctx.clinicId))) as any)
      .returning({ id: leads.id });
    if (!updated) {
      throw new ActionError('not_found', 'Lead não encontrado.');
    }
    return { id: updated.id, tags };
  },
});