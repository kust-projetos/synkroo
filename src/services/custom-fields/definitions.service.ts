/**
 * Custom Field Definitions Service
 * CRUD operations for custom field definitions per clinic
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import type {
  CustomFieldDefinition,
  FieldDefinitionCreateInput,
  FieldDefinitionUpdateInput,
  FieldDefinitionExport,
  ImportDefinitionsResult,
  FieldType,
} from './types'

/**
 * Get all custom field definitions for a clinic
 */
export async function getDefinitions(clinicId: string): Promise<CustomFieldDefinition[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    dbLogger.error('Error getting custom field definitions', error)
    throw error
  }
}

/**
 * Get a single definition by ID
 */
export async function getDefinitionById(
  clinicId: string,
  definitionId: string
): Promise<CustomFieldDefinition | null> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('id', definitionId)
      .eq('clinic_id', clinicId)
      .single()

    if (error) return null
    return data
  } catch (error) {
    dbLogger.error('Error getting custom field definition by ID', error)
    return null
  }
}

/**
 * Create a new custom field definition
 */
export async function createDefinition(
  clinicId: string,
  input: FieldDefinitionCreateInput
): Promise<CustomFieldDefinition> {
  const supabase = await createTypedClient()

  if (!input.name || !input.field_type) {
    throw new Error('Name and field_type are required')
  }

  try {
    const maxSortResult = await supabase
      .from('custom_field_definitions')
      .select('sort_order')
      .eq('clinic_id', clinicId)
      .order('sort_order', { ascending: false })
      .limit(1) as any

    const maxSort = maxSortResult.data?.[0]?.sort_order ?? -1

    const { data, error } = await (supabase
      .from('custom_field_definitions') as any)
      .insert({
        clinic_id: clinicId,
        name: input.name,
        field_type: input.field_type,
        options: input.options || [],
        required: input.required ?? false,
        sort_order: input.sort_order ?? maxSort + 1,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    dbLogger.error('Error creating custom field definition', error)
    throw error
  }
}

/**
 * Update an existing custom field definition
 */
export async function updateDefinition(
  clinicId: string,
  definitionId: string,
  input: FieldDefinitionUpdateInput
): Promise<CustomFieldDefinition> {
  const supabase = await createTypedClient()

  try {
    const updateData: Record<string, unknown> = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.options !== undefined) updateData.options = input.options
    if (input.required !== undefined) updateData.required = input.required
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order
    if (input.is_active !== undefined) updateData.is_active = input.is_active
    updateData.updated_at = new Date().toISOString()

    const { data, error } = await (supabase
      .from('custom_field_definitions') as any)
      .update(updateData)
      .eq('id', definitionId)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    dbLogger.error('Error updating custom field definition', error)
    throw error
  }
}

/**
 * Delete (deactivate) a custom field definition
 */
export async function deleteDefinition(
  clinicId: string,
  definitionId: string
): Promise<void> {
  const supabase = await createTypedClient()

  try {
    const { error } = await (supabase
      .from('custom_field_definitions') as any)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', definitionId)
      .eq('clinic_id', clinicId)

    if (error) throw error
  } catch (error) {
    dbLogger.error('Error deleting custom field definition', error)
    throw error
  }
}

/**
 * Export all definitions for a clinic (for backup/import to another clinic)
 */
export async function exportDefinitions(clinicId: string): Promise<FieldDefinitionExport> {
  const definitions = await getDefinitions(clinicId)

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    definitions: definitions.map(def => ({
      name: def.name,
      field_type: def.field_type,
      options: def.options,
      required: def.required,
      sort_order: def.sort_order,
    })),
  }
}

/**
 * Import definitions from export file
 * Creates new definitions, skips existing names (upsert not overwrite)
 */
export async function importDefinitions(
  clinicId: string,
  exportData: FieldDefinitionExport
): Promise<ImportDefinitionsResult> {
  if (exportData.version !== 1) {
    throw new Error(`Unsupported export version: ${exportData.version}`)
  }

  const supabase = await createTypedClient()
  let created = 0
  let skipped = 0

  const existing = await getDefinitions(clinicId)
  const existingNames = new Set(existing.map(e => e.name))

  try {
    for (const def of exportData.definitions) {
      if (existingNames.has(def.name)) {
        skipped++
        continue
      }

      await (supabase
        .from('custom_field_definitions') as any)
        .insert({
          clinic_id: clinicId,
          name: def.name,
          field_type: def.field_type,
          options: def.options || [],
          required: def.required ?? false,
          sort_order: def.sort_order ?? 0,
          is_active: true,
        })

      created++
    }

    return { created, skipped }
  } catch (error) {
    dbLogger.error('Error importing custom field definitions', error)
    throw error
  }
}