import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { listConsentsForContact } from '../public';

const contactType = z.enum(['patient', 'lead']);

const inputSchema = z.object({
  contactId: z.string().uuid().optional(),
  contactType: contactType.optional(),
  // Accepted while callers migrate from the original action contract.
  patientId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
}).strict().superRefine((input, ctx) => {
  const explicit = input.contactId !== undefined || input.contactType !== undefined;
  const legacy = input.patientId !== undefined || input.leadId !== undefined;
  if (explicit && (!input.contactId || !input.contactType)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contactId and contactType are required together' });
  if (explicit && legacy) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'use one contact selector' });
  if (!explicit && input.patientId !== undefined && input.leadId !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'only one contact is allowed' });
  if (!explicit && !input.patientId && !input.leadId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'a contact is required' });
});

function resolveContact(input: z.infer<typeof inputSchema>) {
  if (input.contactId && input.contactType) return { contactId: input.contactId, contactType: input.contactType };
  if (input.patientId) return { contactId: input.patientId, contactType: 'patient' as const };
  if (input.leadId) return { contactId: input.leadId, contactType: 'lead' as const };
  throw new ActionError('invalid_input', 'Contato obrigatório.');
}

export const listarConsentimentos = defineAction({
  name: 'crm.listarConsentimentos',
  module: 'crm',
  requires: 'lgpd:view_consents',
  label: 'Listar consentimentos',
  input: inputSchema,
  handler: async (input, ctx: ActionContext) => {
    const contact = resolveContact(input);
    const rows = await listConsentsForContact(ctx.clinicId, contact.contactId, contact.contactType);
    if (!rows) throw new ActionError('not_found', 'Contato não encontrado.');
    return rows;
  },
});
