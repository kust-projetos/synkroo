/**
 * Contact (crm) validation schemas (D3 — consolidados das rotas).
 *
 * Movidos verbatim de `src/app/api/contacts/[id]/tags|notes/route.ts`
 * sem alteração de regras.
 */
import { z } from 'zod'

export const updateContactTagsSchema = z.object({
  type: z.enum(['patient', 'lead']),
  tags: z.array(z.string()).default([]),
})

export const addContactNoteSchema = z.object({
  type: z.enum(['patient', 'lead']),
  content: z.string().min(1),
})
