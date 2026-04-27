/**
 * Custom Fields Types
 */

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'checkbox'

export interface CustomFieldDefinition {
  id: string
  clinic_id: string
  name: string
  field_type: FieldType
  options: Array<{ label: string; value: string }>
  required: boolean
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CustomFieldValue {
  id: string
  definition_id: string
  contact_id: string
  contact_type: 'patient' | 'lead'
  clinic_id: string
  value_text: string | null
  value_number: number | null
  value_date: string | null
  value_boolean: boolean | null
  value_json: unknown | null
  field_name?: string
  field_type?: FieldType
}

export interface FieldValueInput {
  definition_id: string
  value: unknown
}

export interface FieldDefinitionCreateInput {
  name: string
  field_type: FieldType
  options?: Array<{ label: string; value: string }>
  required?: boolean
  sort_order?: number
}

export interface FieldDefinitionUpdateInput {
  name?: string
  options?: Array<{ label: string; value: string }>
  required?: boolean
  sort_order?: number
  is_active?: boolean
}

export interface FieldDefinitionExport {
  version: 1
  exported_at: string
  definitions: Array<{
    name: string
    field_type: FieldType
    options: Array<{ label: string; value: string }>
    required: boolean
    sort_order: number
  }>
}

export interface ImportDefinitionsResult {
  created: number
  skipped: number
}