/**
 * L4 Conversation Memory Service
 * PostgreSQL-based conversation data retrieval
 * Provides persistent conversation history and status
 * Migrated from Supabase to Drizzle repositories
 */

import { dbLogger } from '@/lib/logger'
import { findById, findMessagesByConversation, updateConversation } from '@/repositories/conversations'
import type { ChannelType } from '@/lib/supabase/database.types'

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
  status: string
  createdAt: Date
  updatedAt: Date
}

/**
 * L4 Conversation Service
 * Retrieves conversation data from PostgreSQL
 */
export class L4ConversationService {
  /**
   * Get basic conversation info (no messages)
   */
  async getBasicById(conversationId: string): Promise<{
    conversationId: string
    clinicId: string
    patientId?: string
    channel: ChannelType
    status: string
    createdAt: Date
    updatedAt: Date
  } | null> {
    try {
      const conversation = await findById(conversationId)
      if (!conversation) return null
      return {
        conversationId: conversation.id,
        clinicId: conversation.clinicId,
        patientId: conversation.patientId ?? undefined,
        channel: conversation.channel as ChannelType,
        status: conversation.status,
        createdAt: conversation.createdAt ?? new Date(0),
        updatedAt: conversation.updatedAt ?? new Date(0),
      }
    } catch (error) {
      dbLogger.error('Error fetching conversation basic info', error, { conversationId })
      return null
    }
  }

  /**
   * Get conversation by ID with messages
   */
  async getById(conversationId: string): Promise<L4Conversation | null> {
    try {
      // Get conversation
      const conversation = await findById(conversationId)
      if (!conversation) {
        dbLogger.debug('Conversation not found', { conversationId })
        return null
      }

      // Get messages
      const msgs = await findMessagesByConversation(conversationId, { limit: 50 })

      const messages: L4ConversationMessage[] = msgs.map(m => ({
        id: m.id,
        direction: m.direction as 'inbound' | 'outbound',
        content: m.content,
        timestamp: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
        intent: m.intent ?? undefined,
        entities: m.entities ?? undefined,
      }))

      return {
        conversationId: conversation.id,
        clinicId: conversation.clinicId,
        patientId: conversation.patientId ?? undefined,
        visitorId: conversation.externalId ?? undefined,
        channel: conversation.channel as ChannelType,
        messages,
        status: conversation.status,
        createdAt: conversation.createdAt ?? new Date(0),
        updatedAt: conversation.updatedAt ?? new Date(0),
      }
    } catch (error) {
      dbLogger.error('Error fetching conversation by ID', error, { conversationId })
      return null
    }
  }

  /**
   * Get conversation summary (last message only)
   */
  async getSummary(conversationId: string): Promise<{
    lastMessage: string
    lastMessageAt: string
    status: string
  } | null> {
    try {
      const msgs = await findMessagesByConversation(conversationId, { limit: 1 })
      const conversation = await findById(conversationId)
      if (!conversation || msgs.length === 0) return null

      const lastMsg = msgs[0]
      return {
        lastMessage: lastMsg.content,
        lastMessageAt: lastMsg.createdAt instanceof Date ? lastMsg.createdAt.toISOString() : String(lastMsg.createdAt),
        status: conversation.status,
      }
    } catch (error) {
      dbLogger.error('Error fetching conversation summary', error, { conversationId })
      return null
    }
  }

  /**
   * Update conversation status
   */
  async updateStatus(conversationId: string, status: string): Promise<boolean> {
    try {
      await updateConversation(conversationId, { status })
      return true
    } catch (error) {
      dbLogger.error('Error updating conversation status', error, { conversationId, status })
      return false
    }
  }
}

// Singleton instance
export const l4ConversationService = new L4ConversationService()