/**
 * Consent (crm/lgpd) validation schemas (D3 — consolidados da rota).
 *
 * Movidos verbatim de `src/app/api/consents/route.ts` sem alteração de regras.
 */
import { z } from 'zod'

export const contactTypeSchema = z.enum(['patient', 'lead'])
export const consentPurposeSchema = z.enum(['data_collection', 'marketing', 'whatsapp_communication'])
export const consentChannelSchema = z.enum(['web', 'whatsapp', 'manual'])

export const contactQuerySchema = z.object({
  contact_id: z.string().uuid(),
  contact_type: contactTypeSchema,
}).strict()

export const grantConsentSchema = z.object({
  contact_id: z.string().uuid(),
  contact_type: contactTypeSchema,
  purpose: consentPurposeSchema,
  channel: consentChannelSchema.optional(),
  version: z.string().min(1).max(50).optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict()

export const revokeConsentSchema = z.object({
  consent_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  contact_type: contactTypeSchema.optional(),
  purpose: consentPurposeSchema.optional(),
  channel: consentChannelSchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict().superRefine((input, ctx) => {
  if (input.consent_id) {
    if (input.contact_id || input.contact_type || input.purpose) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'consent_id cannot be combined with contact selector' })
    return
  }
  if (!input.contact_id || !input.contact_type || !input.purpose) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'contact_id, contact_type and purpose are required' })
  }
})
