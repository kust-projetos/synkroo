/**
 * Client-safe reminder config types and validation.
 * No DB imports — safe for client components.
 *
 * A regra de validação é a canônica de @/lib/templates/reminder-template
 * (pura, client-safe); este módulo delega via re-export, nunca redefine.
 */

export {
  validateTemplate,
  SUPPORTED_TEMPLATE_PLACEHOLDERS,
  REQUIRED_TEMPLATE_PLACEHOLDERS,
  TEMPLATE_MAX_LENGTH,
} from '@/lib/templates/reminder-template';
export type { TemplateValidation } from '@/lib/templates/reminder-template';

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