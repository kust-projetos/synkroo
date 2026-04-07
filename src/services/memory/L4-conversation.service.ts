/**
 * L4 Conversation Memory Service
 * PostgreSQL-based conversation data retrieval
 * Provides persistent conversation history and status
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import type { ConversationStatus, ChannelType } from '@/lib/supabase/database.types'

// L4 Conversation message structure
export interface L4ConversationMessage {
  id: string
  direction: 'inbound' | 'outbound'
  content: string
  timestamp: string
  intent?: string
  entities?: Record<string, unknown>
}

// L4 Conversation interface
export interface L4Conversation {
  conversationId: string
  clinicId: string
  patientId?: string
  visitorId?: string
  channel: ChannelType
  messages: L4ConversationMessage[]
  status: ConversationStatus
  createdAt: Date
  updatedAt: Date
}

/**
 * L4 Conversation Service
 * Retrieves conversation data from PostgreSQL
 */
export class L4ConversationService {
  /**
   * Get conversation by ID with messages
   */
  async getById(conversationId: string): Promise<L4Conversation | null> {
    try {
      const supabase = await createTypedClient()

      // Get conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single() as any

      if (convError || !conversation) {
        dbLogger.debug('Conversation not found', { conversationId })
        return null
      }

      // Get messages
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, direction, content, created_at, intent, entities')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }) as any

      if (msgError) {
        dbLogger.warn('Error fetching messages', { error: msgError, conversationId })
      }

      const formattedMessages: L4ConversationMessage[] = (messages || []).map((m: any) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        timestamp: m.created_at,
        intent: m.intent || undefined,
        entities: m.entities || undefined,
      }))

      return {
        conversationId: conversation.id,
        clinicId: conversation.clinic_id,
        patientId: conversation.patient_id || undefined,
        visitorId: conversation.external_id || undefined,
        channel: conversation.channel,
        messages: formattedMessages,
        status: conversation.status,
        createdAt: new Date(conversation.created_at),
        updatedAt: new Date(conversation.updated_at),
      }
    } catch (error) {
      dbLogger.error('Error fetching conversation', error, { conversationId })
      return null
    }
  }

  /**
   * Update conversation status
   */
  async updateStatus(conversationId: string, status: ConversationStatus): Promise<boolean> {
    try {
      const supabase = await createTypedClient()

      const { error } = await (supabase
        .from('conversations') as any)
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      if (error) {
        dbLogger.error('Error updating conversation status', error, { conversationId, status })
        return false
      }

      dbLogger.debug('Conversation status updated', { conversationId, status })
      return true
    } catch (error) {
      dbLogger.error('Error updating conversation status', error, { conversationId, status })
      return false
    }
  }

  /**
   * Get conversation without messages (lightweight)
   */
  async getBasicById(conversationId: string): Promise<{
    conversationId: string
    clinicId: string
    patientId?: string
    channel: ChannelType
    status: ConversationStatus
    createdAt: Date
    updatedAt: Date
  } | null> {
    try {
      const supabase = await createTypedClient()

      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('id, clinic_id, patient_id, channel, status, created_at, updated_at')
        .eq('id', conversationId)
        .single() as any

      if (error || !conversation) {
        return null
      }

      return {
        conversationId: conversation.id,
        clinicId: conversation.clinic_id,
        patientId: conversation.patient_id || undefined,
        channel: conversation.channel,
        status: conversation.status,
        createdAt: new Date(conversation.created_at),
        updatedAt: new Date(conversation.updated_at),
      }
    } catch (error) {
      dbLogger.error('Error fetching basic conversation', error, { conversationId })
      return null
    }
  }

  /**
   * Get recent conversations for a patient
   */
  async getRecentByPatient(patientId: string, limit: number = 5): Promise<L4Conversation[]> {
    try {
      const supabase = await createTypedClient()

      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('id, clinic_id, channel, status, created_at, updated_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(limit) as any

      if (error) {
        dbLogger.error('Error fetching recent conversations', error, { patientId })
        return []
      }

      const result: L4Conversation[] = []

      for (const conv of (conversations || [])) {
        const fullConv = await this.getById(conv.id)
        if (fullConv) {
          result.push(fullConv)
        }
      }

      return result
    } catch (error) {
      dbLogger.error('Error fetching recent conversations', error, { patientId })
      return []
    }
  }
}

// Singleton instance
export const l4ConversationService = new L4ConversationService()
