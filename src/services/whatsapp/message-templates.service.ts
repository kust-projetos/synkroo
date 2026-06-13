/**
 * Message Templates Service
 * Manages Meta-approved WhatsApp message templates using Drizzle
 */

import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { messageTemplates } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface MessageTemplate {
  id: string
  clinicId: string
  name: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  header?: string | null
  body: string
  footer?: string | null
  buttons?: Array<{ type: 'QUICK_REPLY' | 'URL' | 'PHONE'; text: string; url?: string }>
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED'
  metaTemplateId: string | null
  createdAt: Date | null
  updatedAt: Date | null
}

/**
 * Get approved templates for a clinic.
 */
export async function getApprovedTemplates(clinicId: string): Promise<MessageTemplate[]> {
  const db = getDb()
  try {
    const rows = await db
      .select()
      .from(messageTemplates)
      .where(and(eq(messageTemplates.clinicId, clinicId), eq(messageTemplates.status, 'APPROVED')))
      .orderBy(messageTemplates.category)

    return rows.map(r => ({
      id: r.id,
      clinicId: r.clinicId,
      name: r.name,
      category: r.category as MessageTemplate['category'],
      language: r.language ?? 'pt_BR',
      header: r.header ?? null,
      body: r.body,
      footer: r.footer ?? null,
      buttons: (r.buttons as MessageTemplate['buttons']) ?? [],
      status: r.status as MessageTemplate['status'],
      metaTemplateId: r.metaTemplateId ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  } catch (error) {
    dbLogger.error('Error fetching approved templates', error)
    return []
  }
}

/**
 * Get all templates (including pending) for a clinic.
 */
export async function getAllTemplates(clinicId: string): Promise<MessageTemplate[]> {
  const db = getDb()
  try {
    const rows = await db
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.clinicId, clinicId))
      .orderBy(desc(messageTemplates.createdAt))

    return rows.map(r => ({
      id: r.id,
      clinicId: r.clinicId,
      name: r.name,
      category: r.category as MessageTemplate['category'],
      language: r.language ?? 'pt_BR',
      header: r.header ?? null,
      body: r.body,
      footer: r.footer ?? null,
      buttons: (r.buttons as MessageTemplate['buttons']) ?? [],
      status: r.status as MessageTemplate['status'],
      metaTemplateId: r.metaTemplateId ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  } catch (error) {
    dbLogger.error('Error fetching templates', error)
    return []
  }
}

/**
 * Create a new template.
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
  const db = getDb()
  try {
    const placeholders = extractPlaceholders(params.body)
    for (const ph of placeholders) {
      if (!ph.match(/^[a-zA-Z0-9_]+$/)) {
        dbLogger.warn('Invalid placeholder in template', { placeholder: ph })
      }
    }

    const [row] = await db
      .insert(messageTemplates)
      .values({
        clinicId: params.clinicId,
        name: params.name,
        category: params.category,
        language: 'pt_BR',
        header: params.header ?? null,
        body: params.body,
        footer: params.footer ?? null,
        buttons: params.buttons ?? [],
        status: 'PENDING',
      } as any)
      .returning()

    return row ? {
      id: row.id,
      clinicId: row.clinicId,
      name: row.name,
      category: row.category as MessageTemplate['category'],
      language: row.language ?? 'pt_BR',
      header: row.header ?? null,
      body: row.body,
      footer: row.footer ?? null,
      buttons: (row.buttons as MessageTemplate['buttons']) ?? [],
      status: row.status as MessageTemplate['status'],
      metaTemplateId: row.metaTemplateId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } : null
  } catch (error) {
    dbLogger.error('Error creating template', error)
    return null
  }
}

/**
 * Fill template placeholders with values.
 */
export function fillTemplate(template: MessageTemplate, values: Record<string, string>): string {
  let message = template.body

  const numberedPh = message.match(/\{\{(\d+)\}\}/g)
  if (numberedPh) {
    const valueArr = Object.values(values)
    for (let i = 0; i < numberedPh.length; i++) {
      message = message.replace(numberedPh[i], valueArr[i] || `{{${i + 1}}}`)
    }
  }

  for (const [key, value] of Object.entries(values)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  return message
}

/**
 * Check if a template is needed (outside 24h window).
 */
export function isTemplateNeeded(lastMessageAt: string | null): boolean {
  if (!lastMessageAt) return true
  const lastMessage = new Date(lastMessageAt)
  const hoursSince = (Date.now() - lastMessage.getTime()) / (1000 * 60 * 60)
  return hoursSince > 24
}

/**
 * Get a template by name for a clinic.
 */
export async function getTemplateByName(clinicId: string, name: string): Promise<MessageTemplate | null> {
  const db = getDb()
  try {
    const [row] = await db
      .select()
      .from(messageTemplates)
      .where(and(
        eq(messageTemplates.clinicId, clinicId),
        eq(messageTemplates.name, name),
        eq(messageTemplates.status, 'APPROVED'),
      ))
      .limit(1)

    if (!row) return null

    return {
      id: row.id,
      clinicId: row.clinicId,
      name: row.name,
      category: row.category as MessageTemplate['category'],
      language: row.language ?? 'pt_BR',
      header: row.header ?? null,
      body: row.body,
      footer: row.footer ?? null,
      buttons: (row.buttons as MessageTemplate['buttons']) ?? [],
      status: row.status as MessageTemplate['status'],
      metaTemplateId: row.metaTemplateId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  } catch {
    return null
  }
}

function extractPlaceholders(body: string): string[] {
  const matches = body.match(/\{\{(\w+)\}\}/g) || []
  return matches.map(m => m.replace(/\{\{|\}\}/g, ''))
}