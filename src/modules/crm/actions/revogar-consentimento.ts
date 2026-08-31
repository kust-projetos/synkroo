import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { revokeConsentById, revokeConsentForContact } from '../public';

const purpose = z.enum(['data_collection', 'marketing', 'whatsapp_communication']);
const contactType = z.enum(['patient', 'lead']);
const inputSchema = z.object({
  consentId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  contactType: contactType.optional(),
  // Accepted while callers migrate from the original action contract.
  patientId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  purpose: purpose.optional(),
  channel: z.enum(['web', 'whatsapp', 'manual']).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict().superRefine((input, ctx) => {
  if (input.consentId) {
    if (input.contactId || input.contactType || input.patientId || input.leadId || input.purpose) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'consentId cannot be combined with a contact selector' });
    }
    return;
  }
  const explicit = input.contactId !== undefined || input.contactType !== undefined;
  const legacy = input.patientId !== undefined || input.leadId !== undefined;
  if (explicit && (!input.contactId || !input.contactType)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contactId and contactType are required together' });
  if (explicit && legacy) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'use one contact selector' });
  if (!explicit && input.patientId === undefined && input.leadId === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a contact is required' });
  if (!explicit && input.patientId !== undefined && input.leadId !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'only one contact is allowed' });
  if (!input.purpose) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'purpose is required' });
});

function resolveContact(input: z.infer<typeof inputSchema>) {
  if (input.contactId && input.contactType) return { contactId: input.contactId, contactType: input.contactType };
  if (input.patientId) return { contactId: input.patientId, contactType: 'patient' as const };
  if (input.leadId) return { contactId: input.leadId, contactType: 'lead' as const };
  throw new ActionError('invalid_input', 'Contato obrigatório.');
}

export const revogarConsentimento = defineAction({
  name: 'crm.revogarConsentimento',
  module: 'crm',
  requires: 'lgpd:manage_consents',
  label: 'Revogar consentimento',
  input: inputSchema,
  handler: async (input, ctx: ActionContext) => {
    const row = input.consentId
      ? await revokeConsentById(ctx.clinicId, input.consentId, ctx.user?.id ?? null)
      : await revokeConsentForContact(ctx.clinicId, {
        ...resolveContact(input),
        purpose: input.purpose!,
        channel: input.channel,
        notes: input.notes,
        actorUserId: ctx.user?.id ?? null,
      });
    if (!row) throw new ActionError('not_found', 'Consentimento ou contato não encontrado.');
    return row;
  },
});
