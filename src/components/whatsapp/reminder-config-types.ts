/**
 * Client-safe reminder config types and validation.
 * No DB imports — safe for client components.
 */

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

interface ValidationResult {
  valid: boolean
  errors: string[]
  missingPlaceholders: string[]
}

const REQUIRED_PLACEHOLDERS = ['paciente_nome', 'data', 'horario']

export function validateTemplate(template: string): ValidationResult {
  const errors: string[] = []
  const missingPlaceholders: string[] = []

  if (!template || template.trim().length === 0) {
    errors.push('Template cannot be empty')
    return { valid: false, errors, missingPlaceholders }
  }

  if (template.length > 1600) {
    errors.push('Template exceeds 1600 character limit')
  }

  // Check for balanced {{ }}
  const openCount = (template.match(/\{\{/g) || []).length
  const closeCount = (template.match(/\}\}/g) || []).length
  if (openCount !== closeCount) {
    errors.push('Unbalanced template placeholders')
  }

  // Check for required placeholders
  for (const placeholder of REQUIRED_PLACEHOLDERS) {
    if (!template.includes(`{{${placeholder}}}`)) {
      missingPlaceholders.push(placeholder)
    }
  }

  if (missingPlaceholders.length > 0) {
    errors.push(`Missing required placeholders: ${missingPlaceholders.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    missingPlaceholders,
  }
}