/**
 * Conversation Context Service
 * Manages short-term memory for conversations via Supabase persistence.
 * Replaces in-memory Map to survive serverless cold starts.
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

interface ContextEntry {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  intent?: string
  entities?: Record<string, unknown>
}

interface ConversationSession {
  id: string
  createdAt: Date
  lastActivityAt: Date
  entries: ContextEntry[]
  extractedInfo: {
    patientName?: string
    requestedDate?: string
    requestedTime?: string
    procedure?: string
    [key: string]: unknown
  }
}

export class ConversationContext {
  // Configuration
  private readonly MAX_CONTEXT_ENTRIES = 10
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

  /**
   * Get or create a session for a conversation.
   * Loads from Supabase, falls back to empty session.
   */
  async getSession(conversationId: string): Promise<ConversationSession> {
    const now = new Date()

    // Try loading from Supabase
    const supabase = await createTypedClient()
    const { data, error } = await supabase
      .from('conversation_sessions')
      .select('*')
      .eq('conversation_id', conversationId)
      .single()

    if (!error && data) {
      const session = this.deserializeSession(data)
      // Check expiry
      if (now.getTime() - session.lastActivityAt.getTime() < this.SESSION_TIMEOUT_MS) {
        return session
      }
      // Expired — clear and recreate
      await this.deleteSessionFromDb(conversationId)
    }

    return this.createSession(conversationId)
  }

  /**
   * Create a new session (in-memory only; persisted on first addMessage)
   */
  private createSession(conversationId: string): ConversationSession {
    const now = new Date()
    return {
      id: conversationId,
      createdAt: now,
      lastActivityAt: now,
      entries: [],
      extractedInfo: {},
    }
  }

  /**
   * Add a message to the context and persist to Supabase
   */
  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      intent?: string
      entities?: Record<string, unknown>
    }
  ): Promise<void> {
    const session = await this.getSession(conversationId)

    // Add entry
    session.entries.push({
      role,
      content,
      timestamp: new Date(),
      intent: metadata?.intent,
      entities: metadata?.entities,
    })

    // Update last activity
    session.lastActivityAt = new Date()

    // Trim to max entries (keep most recent)
    if (session.entries.length > this.MAX_CONTEXT_ENTRIES) {
      session.entries = session.entries.slice(-this.MAX_CONTEXT_ENTRIES)
    }

    // Extract and store important info
    if (metadata?.entities) {
      this.extractImportantInfo(session, metadata.entities)
    }

    // Persist to Supabase
    await this.persistSession(session)
  }

  /**
   * Extract and store important information from entities
   */
  private extractImportantInfo(
    session: ConversationSession,
    entities: Record<string, unknown>
  ): void {
    if (entities.nome) {
      session.extractedInfo.patientName = entities.nome as string
    }
    if (entities.data) {
      session.extractedInfo.requestedDate = entities.data as string
    }
    if (entities.hora) {
      session.extractedInfo.requestedTime = entities.hora as string
    }
    if (entities.procedimento) {
      session.extractedInfo.procedure = entities.procedimento as string
    }
  }

  /**
   * Get conversation history for context
   */
  async getContext(conversationId: string): Promise<Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>> {
    const session = await this.getSession(conversationId)
    return session.entries.map((entry) => ({
      role: entry.role,
      content: entry.content,
    }))
  }

  /**
   * Get extracted information
   */
  async getExtractedInfo(conversationId: string): Promise<ConversationSession['extractedInfo']> {
    const session = await this.getSession(conversationId)
    return session.extractedInfo
  }

  /**
   * Clear a specific session
   */
  async clearSession(conversationId: string): Promise<void> {
    await this.deleteSessionFromDb(conversationId)
  }

  /**
   * Build context summary for AI
   */
  async buildContextSummary(conversationId: string): Promise<string> {
    const session = await this.getSession(conversationId)
    if (session.entries.length === 0) {
      return 'Nova conversa sem histórico.'
    }

    const info = session.extractedInfo
    const infoParts: string[] = []

    if (info.patientName) infoParts.push(`Nome: ${info.patientName}`)
    if (info.requestedDate) infoParts.push(`Data desejada: ${info.requestedDate}`)
    if (info.requestedTime) infoParts.push(`Horário desejado: ${info.requestedTime}`)
    if (info.procedure) infoParts.push(`Procedimento: ${info.procedure}`)

    if (infoParts.length > 0) {
      return `Informações coletadas: ${infoParts.join(', ')}`
    }

    return 'Nenhuma informação específica coletada ainda.'
  }

  // ─── Persistence helpers ────────────────────────────────────────────

  private async persistSession(session: ConversationSession): Promise<void> {
    try {
      const supabase = await createTypedClient()
      const serialized = this.serializeSession(session)

      await (supabase
        .from('conversation_sessions') as any)
        .upsert(serialized, { onConflict: 'conversation_id' })
    } catch (err) {
      dbLogger.warn('Failed to persist conversation session', { error: String(err) })
    }
  }

  private async deleteSessionFromDb(conversationId: string): Promise<void> {
    try {
      const supabase = await createTypedClient()
      await supabase
        .from('conversation_sessions')
        .delete()
        .eq('conversation_id', conversationId)
    } catch (err) {
      dbLogger.warn('Failed to delete conversation session', { error: String(err) })
    }
  }

  private serializeSession(session: ConversationSession): Record<string, unknown> {
    return {
      conversation_id: session.id,
      entries: JSON.stringify(session.entries.map(e => ({
        role: e.role,
        content: e.content,
        timestamp: e.timestamp.toISOString(),
        intent: e.intent,
        entities: e.entities,
      }))),
      extracted_info: JSON.stringify(session.extractedInfo),
      created_at: session.createdAt.toISOString(),
      last_activity_at: session.lastActivityAt.toISOString(),
    }
  }

  private deserializeSession(data: Record<string, unknown>): ConversationSession {
    const entries = typeof data.entries === 'string' ? JSON.parse(data.entries) : (data.entries || [])
    const extractedInfo = typeof data.extracted_info === 'string' ? JSON.parse(data.extracted_info) : (data.extracted_info || {})

    return {
      id: data.conversation_id as string,
      createdAt: new Date(data.created_at as string),
      lastActivityAt: new Date(data.last_activity_at as string),
      entries: entries.map((e: Record<string, unknown>) => ({
        role: e.role as 'user' | 'assistant' | 'system',
        content: e.content as string,
        timestamp: new Date(e.timestamp as string),
        intent: e.intent as string | undefined,
        entities: e.entities as Record<string, unknown> | undefined,
      })),
      extractedInfo,
    }
  }
}

// Singleton instance
export const conversationContext = new ConversationContext()
