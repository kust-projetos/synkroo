/** Custom Field Definitions Service — migrated to Drizzle */
import { eq, and, asc, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { customFieldDefinitions } from '@/lib/db/schema/infra'
import { dbLogger } from '@/lib/logger'
import type { CustomFieldDefinition, FieldDefinitionCreateInput, FieldDefinitionUpdateInput, FieldDefinitionExport, ImportDefinitionsResult } from './types'

const CF = customFieldDefinitions

function toSnake(r: any): CustomFieldDefinition {
  return {
    id: r.id,
    clinic_id: r.clinicId ?? '',
    name: r.name ?? '',
    field_type: r.fieldType ?? 'text',
    options: r.options ?? [],
    required: r.required ?? false,
    sort_order: r.sortOrder ?? 0,
    is_active: r.isActive ?? true,
    created_at: r.createdAt?.toISOString?.() ?? '',
    updated_at: r.updatedAt?.toISOString?.() ?? '',
  }
}

export async function getDefinitions(clinicId: string): Promise<CustomFieldDefinition[]> {
  const db = getDb()
  try {
    const rows = await db.select().from(CF).where(and(eq(CF.clinicId, clinicId), eq(CF.isActive, true))).orderBy(asc(CF.sortOrder))
    return rows.map(toSnake)
  } catch (error) { dbLogger.error('Error getting custom field definitions', error); throw error }
}

export async function getDefinitionById(clinicId: string, definitionId: string): Promise<CustomFieldDefinition | null> {
  const db = getDb()
  try {
    const [row] = await db.select().from(CF).where(and(eq(CF.id, definitionId), eq(CF.clinicId, clinicId)))
    return row ? toSnake(row) : null
  } catch (error) { dbLogger.error('Error getting custom field definition by ID', error); return null }
}

export async function createDefinition(clinicId: string, input: FieldDefinitionCreateInput): Promise<CustomFieldDefinition> {
  const db = getDb()
  if (!input.name || !input.field_type) throw new Error('Name and field_type are required')
  try {
    const [last] = await db.select({ sortOrder: CF.sortOrder }).from(CF).where(eq(CF.clinicId, clinicId)).orderBy(desc(CF.sortOrder)).limit(1)
    const maxSort = last?.sortOrder ?? -1
    const [row] = await db.insert(CF).values({
      clinicId, name: input.name, fieldType: input.field_type, options: input.options ?? [],
      required: input.required ?? false, sortOrder: input.sort_order ?? maxSort + 1, isActive: true,
    }).returning()
    return toSnake(row)
  } catch (error) { dbLogger.error('Error creating custom field definition', error); throw error }
}

export async function updateDefinition(clinicId: string, definitionId: string, input: FieldDefinitionUpdateInput): Promise<CustomFieldDefinition> {
  const db = getDb()
  const set: any = { updatedAt: new Date() }
  const map: Record<string, string> = { name: 'name', options: 'options', required: 'required', sort_order: 'sortOrder', is_active: 'isActive' }
  for (const [k, v] of Object.entries(map)) { if ((input as any)[k] !== undefined) set[v] = (input as any)[k] }
  try {
    const [row] = await db.update(CF).set(set).where(and(eq(CF.id, definitionId), eq(CF.clinicId, clinicId))).returning()
    return toSnake(row)
  } catch (error) { dbLogger.error('Error updating custom field definition', error); throw error }
}

export async function deleteDefinition(clinicId: string, definitionId: string): Promise<void> {
  const db = getDb()
  try {
    await db.update(CF).set({ isActive: false, updatedAt: new Date() }).where(and(eq(CF.id, definitionId), eq(CF.clinicId, clinicId)))
  } catch (error) { dbLogger.error('Error deleting custom field definition', error); throw error }
}

export async function exportDefinitions(clinicId: string): Promise<FieldDefinitionExport> {
  const definitions = await getDefinitions(clinicId)
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    definitions: definitions.map((def) => ({ name: def.name, field_type: def.field_type, options: def.options, required: def.required, sort_order: def.sort_order })),
  }
}

export async function importDefinitions(clinicId: string, exportData: FieldDefinitionExport): Promise<ImportDefinitionsResult> {
  if (exportData.version !== 1) throw new Error(`Unsupported export version: ${exportData.version}`)
  const db = getDb()
  const existing = await getDefinitions(clinicId)
  const existingNames = new Set(existing.map((e) => e.name))
  let created = 0, skipped = 0
  try {
    for (const def of exportData.definitions) {
      if (existingNames.has(def.name)) { skipped++; continue }
      await db.insert(CF).values({ clinicId, name: def.name, fieldType: def.field_type, options: def.options ?? [], required: def.required ?? false, sortOrder: def.sort_order ?? 0, isActive: true })
      created++
    }
    return { created, skipped }
  } catch (error) { dbLogger.error('Error importing custom field definitions', error); throw error }
}
