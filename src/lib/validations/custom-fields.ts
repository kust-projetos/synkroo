/**
 * Custom-fields validation schemas (D2 lote 1 / D3 — consolidados das rotas).
 *
 * Movidos verbatim de `src/app/api/custom-fields/**` sem alteração de regras.
 * As rotas importam daqui; a fonte canônica passa a ser este arquivo.
 */
import { z } from 'zod'

const customFieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
})

export const createCustomFieldDefinitionSchema = z.object({
  name: z.string().min(1),
  field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox']),
  options: z.array(customFieldOptionSchema).optional(),
  required: z.boolean().optional(),
  sort_order: z.number().optional(),
})

export const updateCustomFieldDefinitionSchema = z.object({
  name: z.string().min(1).optional(),
  options: z.array(customFieldOptionSchema).optional(),
  required: z.boolean().optional(),
  sort_order: z.number().optional(),
  is_active: z.boolean().optional(),
})

export const importCustomFieldDefinitionsSchema = z.object({
  version: z.literal(1),
  exported_at: z.string(),
  definitions: z.array(z.object({
    name: z.string(),
    field_type: z.enum(['text', 'number', 'date', 'select', 'checkbox']),
    options: z.array(customFieldOptionSchema).optional(),
    required: z.boolean().optional(),
    sort_order: z.number().optional(),
  })),
})

export const upsertCustomFieldValuesSchema = z.object({
  contact_id: z.string().uuid(),
  contact_type: z.enum(['patient', 'lead']),
  values: z.array(z.object({
    definition_id: z.string().uuid(),
    value: z.unknown(),
  })),
})
