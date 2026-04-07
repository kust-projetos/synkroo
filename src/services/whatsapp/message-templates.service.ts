/**
 * Message Templates Service
 * Manages Meta-approved WhatsApp message templates
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface MessageTemplate {
  id: string
  clinic_id: string
  name: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string // 'pt_BR'
  header?: string
  body: string
  footer?: string
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE'; text: string; url?: string }>
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED'
  meta_template_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Get approved templates for a clinic
 */
export async function getApprovedTemplates(clinicId: string): Promise<MessageTemplate[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'APPROVED')
      .order('category', { ascending: true })

    if (error) throw error

    return (data || []) as MessageTemplate[]
  } catch (error) {
    dbLogger.error('Error fetching approved templates', error)
    return []
  }
}

/**
 * Get all templates (including pending)
 */
export async function getAllTemplates(clinicId: string): Promise<MessageTemplate[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []) as MessageTemplate[]
  } catch (error) {
    dbLogger.error('Error fetching templates', error)
    return []
  }
}

/**
 * Create a new template
 */
export async function createTemplate(params: {
  clinicId: string
  name: string
  category: MessageTemplate['category']
  body: string
  header?: string
  footer?: string
  buttons?: MessageTemplate['buttons']
}): Promise<MessageTemplate | null> {
  const supabase = await createTypedClient()

  try {
    // Validate placeholders in body
    const placeholders = extractPlaceholders(params.body)
    for (const ph of placeholders) {
      if (!ph.match(/^[a-zA-Z0-9_]+$/)) {
        dbLogger.warn('Invalid placeholder in template', { placeholder: ph })
      }
    }

    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        clinic_id: params.clinicId,
        name: params.name,
        category: params.category,
        language: 'pt_BR',
        header: params.header || null,
        body: params.body,
        footer: params.footer || null,
        buttons: params.buttons || null,
        status: 'PENDING',
      })
      .select()
      .single()

    if (error) throw error

    return data as MessageTemplate
  } catch (error) {
    dbLogger.error('Error creating template', error)
    return null
  }
}

/**
 * Fill template placeholders with values
 */
export function fillTemplate(
  template: MessageTemplate,
  values: Record<string, string>
): string {
  let message = template.body

  // Replace numbered placeholders {{1}}, {{2}}, etc
  const numberedPh = message.match(/\{\{(\d+)\}\}/g)
  if (numberedPh) {
    const valueArr = Object.values(values)
    for (let i = 0; i < numberedPh.length; i++) {
      message = message.replace(numberedPh[i], valueArr[i] || `{{${i + 1}}}`)
    }
  }

  // Replace named placeholders {{name}}, {{date}}, etc
  for (const [key, value] of Object.entries(values)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  return message
}

/**
 * Check if a template is needed (outside 24h window)
 */
export function isTemplateNeeded(lastMessageAt: string | null): boolean {
  if (!lastMessageAt) return true

  const lastMessage = new Date(lastMessageAt)
  const now = new Date()
  const hoursSince = (now.getTime() - lastMessage.getTime()) / (1000 * 60 * 60)

  return hoursSince > 24
}

/**
 * Get a template by name for a clinic
 */
export async function getTemplateByName(
  clinicId: string,
  name: string
): Promise<MessageTemplate | null> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('name', name)
      .eq('status', 'APPROVED')
      .single()

    if (error) return null

    return data as MessageTemplate
  } catch {
    return null
  }
}

/**
 * Extract placeholders from template body
 */
function extractPlaceholders(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) || []
  return matches.map((m) => m.replace(/\{\{|\}\}/g, ''))
}
