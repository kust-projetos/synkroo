/**
 * Custom Field Values Service
 * Get/set custom field values for contacts (patients/leads)
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import type {
  CustomFieldValue,
  FieldValueInput,
} from './types'

type ContactType = 'patient' | 'lead'

/**
 * Get all custom field values for a contact
 */
export async function getValuesForContact(
  clinicId: string,
  contactId: string,
  contactType: ContactType
): Promise<CustomFieldValue[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('custom_field_values')
      .select('*, field_name:custom_field_definitions(name), field_type:custom_field_definitions(field_type)')
      .eq('contact_id', contactId)
      .eq('contact_type', contactType)
      .eq('clinic_id', clinicId)

    if (error) throw error
    return data || []
  } catch (error) {
    dbLogger.error('Error getting custom field values for contact', error)
    throw error
  }
}

/**
 * Upsert custom field values for a contact
 * Takes array of { definition_id, value } and inserts/updates accordingly
 */
export async function upsertValues(
  clinicId: string,
  contactId: string,
  contactType: ContactType,
  values: FieldValueInput[]
): Promise<CustomFieldValue[]> {
  const supabase = await createTypedClient()

  if (!values || values.length === 0) {
    return []
  }

  try {
    const results: CustomFieldValue[] = []

    for (const input of values) {
      const { definition_id, value } = input

      // Get field type from definition to know which column to use
      const { data: def } = await supabase
        .from('custom_field_definitions')
        .select('field_type')
        .eq('id', definition_id)
        .eq('clinic_id', clinicId)
        .single() as any

      if (!def) {
        dbLogger.warn(`Definition ${definition_id} not found, skipping`)
        continue
      }

      const valueRecord: Record<string, unknown> = {
        clinic_id: clinicId,
        contact_id: contactId,
        contact_type: contactType,
        definition_id,
      }

      // Clear all value columns first
      valueRecord.value_text = null
      valueRecord.value_number = null
      valueRecord.value_date = null
      valueRecord.value_boolean = null
      valueRecord.value_json = null

      // Set the appropriate column based on field type
      switch (def.field_type) {
        case 'text':
          valueRecord.value_text = String(value ?? '')
          break
        case 'number':
          valueRecord.value_number = value !== null && value !== '' ? Number(value) : null
          break
        case 'date':
          valueRecord.value_date = value ? String(value) : null
          break
        case 'checkbox':
          valueRecord.value_boolean = Boolean(value)
          break
        case 'select':
          valueRecord.value_json = value
          break
      }

      // Upsert
      const { data, error } = await (supabase
        .from('custom_field_values') as any)
        .upsert(valueRecord, {
          onConflict: 'contact_id,definition_id,contact_type',
        })
        .select()
        .single()

      if (error) {
        dbLogger.error(`Error upserting value for definition ${definition_id}`, error)
        continue
      }

      results.push(data)
    }

    return results
  } catch (error) {
    dbLogger.error('Error upserting custom field values', error)
    throw error
  }
}

/**
 * Search contacts by custom field value
 * Returns contact IDs that match a specific custom field value
 */
export async function searchByCustomField(
  clinicId: string,
  definitionId: string,
  value: unknown
): Promise<string[]> {
  const supabase = await createTypedClient()

  try {
    // First get field type
    const { data: def } = await supabase
      .from('custom_field_definitions')
      .select('field_type')
      .eq('id', definitionId)
      .eq('clinic_id', clinicId)
      .single() as any

    if (!def) {
      return []
    }

    let query = supabase
      .from('custom_field_values')
      .select('contact_id')
      .eq('definition_id', definitionId)
      .eq('clinic_id', clinicId)

    // Apply value filter based on field type
    switch (def.field_type) {
      case 'text':
        query = query.eq('value_text', String(value ?? '')) as typeof query
        break
      case 'number':
        query = query.eq('value_number', Number(value)) as typeof query
        break
      case 'date':
        query = query.eq('value_date', String(value)) as typeof query
        break
      case 'checkbox':
        query = query.eq('value_boolean', Boolean(value)) as typeof query
        break
      case 'select':
        query = query.eq('value_json', value as string) as typeof query
        break
    }

    const { data, error } = await query

    if (error) throw error
    return (data || []).map((v: any) => v.contact_id)
  } catch (error) {
    dbLogger.error('Error searching by custom field', error)
    throw error
  }
}

/**
 * Delete all custom field values for a contact
 */
export async function deleteValuesForContact(
  clinicId: string,
  contactId: string,
  contactType: ContactType
): Promise<void> {
  const supabase = await createTypedClient()

  try {
    const { error } = await supabase
      .from('custom_field_values')
      .delete()
      .eq('contact_id', contactId)
      .eq('contact_type', contactType)
      .eq('clinic_id', clinicId)

    if (error) throw error
  } catch (error) {
    dbLogger.error('Error deleting custom field values for contact', error)
    throw error
  }
}