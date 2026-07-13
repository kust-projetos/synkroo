import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { recalculateDuplicatesForLead } from '@/modules/crm';
import { ActionError } from '@/core/actions/types';
import { updateLead, findLeadByIdForClinic } from '../repositories/leads-repository';

export const atualizarLead = defineAction({
  name: 'comercial.atualizarLead',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Atualizar lead',
  input: z.object({
    leadId: z.string().uuid(),
    clinicId: z.string().uuid().optional(),
    name: z.string().optional(),
    email: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    status: z.string().optional(),
    assignedTo: z.string().uuid().nullable().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const existing = await findLeadByIdForClinic(input.leadId, ctx.clinicId);
    if (!existing) throw new ActionError('not_found', 'Lead não encontrado.');

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.email !== undefined) patch.email = input.email;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status !== undefined) patch.status = input.status;
    if (input.assignedTo !== undefined) patch.assignedTo = input.assignedTo;

    const updated = await updateLead(input.leadId, ctx.clinicId, patch);
    if (!updated) throw new ActionError('not_found', 'Lead não encontrado.');
    await recalculateDuplicatesForLead({
      clinicId: ctx.clinicId,
      leadId: updated.id,
    });
    return { id: updated.id };
  },
});
