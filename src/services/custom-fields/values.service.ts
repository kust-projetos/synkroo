/** Custom Field Values Service — migrated to Drizzle */
import { eq, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { customFieldDefinitions, customFieldValues } from '@/lib/db/schema/infra'
import { dbLogger } from '@/lib/logger'
import type { CustomFieldValue, FieldValueInput } from './types'

type ContactType = 'patient' | 'lead'

const CFL = customFieldDefinitions
const CFV = customFieldValues

function toSnake(r: any): CustomFieldValue {
  return {
    id: r.id,
    clinic_id: r.clinicId ?? '',
    contact_id: r.contactId ?? '',
    contact_type: r.contactType ?? '',
    definition_id: r.definitionId ?? '',
    value_text: r.valueText ?? null,
    value_number: r.valueNumber ?? null,
    value_date: r.valueDate?.toISOString?.() ?? null,
    value_boolean: r.valueBoolean ?? null,
    value_json: r.valueJson ?? null,
  }
}

export async function getValuesForContact(clinicId: string, contactId: string, contactType: ContactType): Promise<CustomFieldValue[]> {
  const db = getDb()
  try {
    const rows = await db.select().from(CFV).where(and(eq(CFV.contactId, contactId), eq(CFV.contactType, contactType), eq(CFV.clinicId, clinicId)))
    return rows.map(toSnake)
  } catch (error) { dbLogger.error('Error getting custom field values for contact', error); throw error }
}

export async function upsertValues(clinicId: string, contactId: string, contactType: ContactType, values: FieldValueInput[]): Promise<CustomFieldValue[]> {
  const db = getDb()
  if (!values.length) return []
  const results: CustomFieldValue[] = []

  for (const input of values) {
    const { definition_id, value } = input
    const [def] = await db.select({ fieldType: CFL.fieldType }).from(CFL).where(and(eq(CFL.id, definition_id), eq(CFL.clinicId, clinicId)))
    if (!def) { dbLogger.warn(`Definition ${definition_id} not found, skipping`); continue }

    const valueRecord: any = { clinicId, contactId, contactType, definitionId: definition_id, valueText: null, valueNumber: null, valueDate: null, valueBoolean: null, valueJson: null }

    switch (def.fieldType) {
      case 'text':   valueRecord.valueText = String(value ?? ''); break
      case 'number': valueRecord.valueNumber = value !== null && value !== '' ? Number(value) : null; break
      case 'date':   valueRecord.valueDate = value ? new Date(String(value)) : null; break
      case 'checkbox': valueRecord.valueBoolean = Boolean(value); break
      case 'select': valueRecord.valueJson = value; break
    }

    try {
      const [row] = await db.insert(CFV).values(valueRecord).onConflictDoUpdate({ target: [CFV.definitionId, CFV.contactId, CFV.contactType], set: valueRecord }).returning()
      results.push(toSnake(row))
    } catch (e) { dbLogger.error(`Error upserting value for definition ${definition_id}`, e) }
  }
  return results
}

export async function searchByCustomField(clinicId: string, definitionId: string, value: unknown): Promise<string[]> {
  const db = getDb()
  try {
    const [def] = await db.select({ fieldType: CFL.fieldType }).from(CFL).where(and(eq(CFL.id, definitionId), eq(CFL.clinicId, clinicId)))
    if (!def) return []

    const conditions = [eq(CFV.definitionId, definitionId), eq(CFV.clinicId, clinicId)]
    switch (def.fieldType) {
      case 'text':   conditions.push(eq(CFV.valueText, String(value ?? ''))); break
      case 'number': conditions.push(eq(CFV.valueNumber, Number(value))); break
      case 'date':   conditions.push(eq(CFV.valueDate, value ? new Date(String(value)) : null as any)); break
      case 'checkbox': conditions.push(eq(CFV.valueBoolean, Boolean(value))); break
      case 'select': conditions.push(eq(CFV.valueJson, value as any)); break
    }

    const rows = await db.select({ contactId: CFV.contactId }).from(CFV).where(and(...conditions))
    return rows.map((r) => r.contactId)
  } catch (error) { dbLogger.error('Error searching by custom field', error); throw error }
}

export async function deleteValuesForContact(clinicId: string, contactId: string, contactType: ContactType): Promise<void> {
  const db = getDb()
  try {
    await db.delete(CFV).where(and(eq(CFV.contactId, contactId), eq(CFV.contactType, contactType), eq(CFV.clinicId, clinicId)))
  } catch (error) { dbLogger.error('Error deleting custom field values for contact', error); throw error }
}
