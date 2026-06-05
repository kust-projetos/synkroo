/**
 * Procedure Reminder Config Service
 * Manages per-procedure-type reminder configurations with D-05 defaults
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import { fillTemplate } from '@/services/whatsapp/message-templates.service'

export interface ReminderConfigPerProcedure {
  id?: string
  procedure_type_id: string
  procedure_type_name: string
  hours_before: number // 24, 48, or 168 (1 week)
  message_template: string
  enabled: boolean
  created_at?: string
  updated_at?: string
}

interface ReminderConfigRow {
  id: string
  clinic_id: string
  procedure_type_id: string
  hours_before: number
  message_template: string
  enabled: boolean
  created_at: string
  updated_at: string
}

interface ProcedureTypeRow {
  id: string
  name: string
}

/**
 * D-05 defaults per procedure type name
 */
const D05_DEFAULTS: Record<string, number> = {
  'check-up': 48,
  consulta: 48,
  avaliacao: 48,
  procedimento: 24,
  tratamento: 24,
  cirurgia: 24,
}

const DEFAULT_HOURS = 24

/**
 * Get default reminder hours for a procedure type based on D-05
 */
export function getDefaultReminderHours(procedureTypeName: string): number {
  const normalized = procedureTypeName.toLowerCase().trim()
  return D05_DEFAULTS[normalized] ?? DEFAULT_HOURS
}

/**
 * Get default template for a procedure type
 */
export function getDefaultTemplate(procedureTypeName: string): string {
  return `Olá {{paciente_nome}}! Aqui é da clínica. Lembrando que você tem uma consulta de {{procedimento}} marcada para {{data}} às {{horario}} com {{dentista}}. Por favor, confirme sua presença.`
}

/**
 * Get reminder config for a specific procedure type
 */
export async function getProcedureReminderConfig(
  clinicId: string,
  procedureTypeId: string
): Promise<ReminderConfigPerProcedure | null> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await (supabase
      .from('appointment_reminder_configs') as any)
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('procedure_type_id', procedureTypeId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No custom config, return null
        return null
      }
      dbLogger.error('Error fetching procedure reminder config', error)
      return null
    }

    return data as ReminderConfigPerProcedure
  } catch (error) {
    dbLogger.error('Error fetching procedure reminder config', error)
    return null
  }
}

/**
 * Get all reminder configs for a clinic
 */
export async function getAllProcedureReminderConfigs(
  clinicId: string
): Promise<ReminderConfigPerProcedure[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await (supabase
      .from('appointment_reminder_configs') as any)
      .select('*')
      .eq('clinic_id', clinicId)

    if (error) throw error

    return (data || []) as ReminderConfigPerProcedure[]
  } catch (error) {
    dbLogger.error('Error fetching all procedure reminder configs', error)
    return []
  }
}

/**
 * Save (upsert) reminder config for a procedure type
 */
export async function saveProcedureReminderConfig(
  clinicId: string,
  config: Omit<ReminderConfigPerProcedure, 'created_at' | 'updated_at'>
): Promise<{ success: boolean; config?: ReminderConfigPerProcedure; error?: string }> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await (supabase
      .from('appointment_reminder_configs') as any)
      .upsert(
        {
          clinic_id: clinicId,
          procedure_type_id: config.procedure_type_id,
          hours_before: config.hours_before,
          message_template: config.message_template,
          enabled: config.enabled,
        },
        {
          onConflict: 'clinic_id,procedure_type_id',
        }
      )
      .select()
      .single()

    if (error) throw error

    return { success: true, config: data as ReminderConfigPerProcedure }
  } catch (error) {
    dbLogger.error('Error saving procedure reminder config', error)
    return { success: false, error: 'Failed to save config' }
  }
}

/**
 * Get procedure types for a clinic
 */
export async function getProcedureTypes(
  clinicId: string
): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('procedure_types')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .order('name', { ascending: true })

    if (error) throw error

    return (data || []) as ProcedureTypeRow[]
  } catch (error) {
    dbLogger.error('Error fetching procedure types', error)
    return []
  }
}

/**
 * Validate template placeholders
 * Returns errors for invalid placeholders
 */
export function validateTemplate(template: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Extract placeholders like {{name}}
  const placeholderRegex = /\{\{(\w+)\}\}/g
  const matches = template.match(placeholderRegex) || []
  const placeholders = matches.map((m) => m.replace(/\{\{|\}\}/g, ''))

  // Validate each placeholder matches expected pattern
  const validPattern = /^[a-zA-Z0-9_]+$/
  for (const ph of placeholders) {
    if (!ph.match(validPattern)) {
      errors.push(`Placeholder inválido: {{${ph}}}`)
    }
  }

  // Check for unsupported placeholders
  const supportedPlaceholders = ['paciente_nome', 'data', 'horario', 'dentista', 'procedimento']
  for (const ph of placeholders) {
    if (!supportedPlaceholders.includes(ph)) {
      errors.push(`Placeholder não suportado: {{${ph}}}. Use: ${supportedPlaceholders.join(', ')}`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Replace placeholders in template with values
 */
export function replacePlaceholders(
  template: string,
  values: {
    paciente_nome?: string
    data?: string
    horario?: string
    dentista?: string
    procedimento?: string
  }
): string {
  const fakeTemplate = { body: template } as Parameters<typeof fillTemplate>[0]
  return fillTemplate(fakeTemplate, values as Record<string, string>)
}

/**
 * Get effective config (custom or default) for a procedure type
 */
export async function getEffectiveConfig(
  clinicId: string,
  procedureTypeId: string,
  procedureTypeName: string
): Promise<ReminderConfigPerProcedure> {
  const customConfig = await getProcedureReminderConfig(clinicId, procedureTypeId)

  if (customConfig) {
    return customConfig
  }

  // Return default config
  return {
    procedure_type_id: procedureTypeId,
    procedure_type_name: procedureTypeName,
    hours_before: getDefaultReminderHours(procedureTypeName),
    message_template: getDefaultTemplate(procedureTypeName),
    enabled: true,
  }
}