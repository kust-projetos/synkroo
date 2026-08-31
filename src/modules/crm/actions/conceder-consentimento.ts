import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { grantConsentForContact } from '../public';

const purpose = z.enum(['data_collection', 'marketing', 'whatsapp_communication']);
const channel = z.enum(['web', 'whatsapp', 'manual']);
const inputSchema = z.object({
  contactId: z.string().uuid().optional(),
  contactType: z.enum(['patient', 'lead']).optional(),
  // Accepted while callers migrate from the original action contract.
  patientId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  purpose,
  channel: channel.optional(),
  version: z.string().min(1).max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict().superRefine((input, ctx) => {
  const explicit = input.contactId !== undefined || input.contactType !== undefined;
  const legacy = input.patientId !== undefined || input.leadId !== undefined;
  if (explicit && (!input.contactId || !input.contactType)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contactId and contactType are required together' });
  if (explicit && legacy) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'use one contact selector' });
  if (!explicit && input.patientId === undefined && input.leadId === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a contact is required' });
  if (!explicit && input.patientId !== undefined && input.leadId !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'only one contact is allowed' });
});

function resolveContact(input: z.infer<typeof inputSchema>) {
  if (input.contactId && input.contactType) return { contactId: input.contactId, contactType: input.contactType };
  if (input.patientId) return { contactId: input.patientId, contactType: 'patient' as const };
  if (input.leadId) return { contactId: input.leadId, contactType: 'lead' as const };
  throw new ActionError('invalid_input', 'Contato obrigatório.');
}

export const concederConsentimento = defineAction({
  name: 'crm.concederConsentimento',
  module: 'crm',
  requires: 'lgpd:manage_consents',
  label: 'Conceder consentimento',
  input: inputSchema,
  handler: async (input, ctx: ActionContext) => {
    const contact = resolveContact(input);
    const row = await grantConsentForContact(ctx.clinicId, {
      ...contact,
      purpose: input.purpose,
      channel: input.channel,
      version: input.version,
      notes: input.notes,
      actorUserId: ctx.user?.id ?? null,
    });
    if (!row) throw new ActionError('not_found', 'Contato não encontrado.');
    return row;
  },
});
