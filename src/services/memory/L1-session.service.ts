/**
 * L1 Session Memory Service
 * In-memory session storage with 30-minute TTL
 * Provides fast access to short-term conversation context
 */

import { dbLogger } from '@/lib/logger'

// Session message structure
export interface L1SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  intent?: string
  entities?: Record<string, unknown>
}

// L1 Session interface
export interface L1Session {
  sessionId: string
  visitorId: string
  messages: L1SessionMessage[]
  currentIntent?: string
  entities: Record<string, unknown>
  createdAt: Date
  expiresAt: Date
}

// TTL in milliseconds (30 minutes)
const SESSION_TTL_MS = 30 * 60 * 1000

// In-memory session store
const sessions = new Map<string, L1Session>()

// Cleanup interval reference
let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * L1 Session Service
 * Manages in-memory session data with automatic TTL expiration
 */
export class L1SessionService {
  /**
   * Create a new session
   */
  create(sessionId: string, visitorId: string): L1Session {
    const now = new Date()
    const session: L1Session = {
      sessionId,
      visitorId,
      messages: [],
      entities: {},
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    }

    sessions.set(sessionId, session)
    dbLogger.debug('L1 session created', { sessionId, visitorId })

    return session
  }

  /**
   * Get a session by ID
   * Returns null if not found or expired
   */
  get(sessionId: string): L1Session | null {
    const session = sessions.get(sessionId)

    if (!session) {
      return null
    }

    // Check if expired
    if (new Date() > session.expiresAt) {
      this.delete(sessionId)
      return null
    }

    return session
  }

  /**
   * Update a session (refreshes TTL)
   */
  update(sessionId: string, updates: Partial<Pick<L1Session, 'currentIntent' | 'entities'>>): L1Session | null {
    const session = this.get(sessionId)

    if (!session) {
      return null
    }

    // Apply updates
    if (updates.currentIntent !== undefined) {
      session.currentIntent = updates.currentIntent
    }

    if (updates.entities !== undefined) {
      session.entities = { ...session.entities, ...updates.entities }
    }

    // Refresh TTL
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    sessions.set(sessionId, session)

    return session
  }

  /**
   * Add a message to a session
   */
  addMessage(
    sessionId: string,
    message: Omit<L1SessionMessage, 'timestamp'>
  ): L1Session | null {
    const session = this.get(sessionId)

    if (!session) {
      return null
    }

    const newMessage: L1SessionMessage = {
      ...message,
      timestamp: new Date().toISOString(),
    }

    session.messages.push(newMessage)

    // Update entities if provided
    if (message.entities) {
      session.entities = { ...session.entities, ...message.entities }
    }

    // Update current intent if provided
    if (message.intent) {
      session.currentIntent = message.intent
    }

    // Refresh TTL
    session.expiresAt = new Date(Date.now() + SESSION_TTL_MS)

    sessions.set(sessionId, session)

    return session
  }

  /**
   * Get or create a session
   */
  getOrCreate(sessionId: string, visitorId: string): L1Session {
    const existing = this.get(sessionId)

    if (existing) {
      return existing
    }

    return this.create(sessionId, visitorId)
  }

  /**
   * Delete a session
   */
  delete(sessionId: string): boolean {
    const deleted = sessions.delete(sessionId)

    if (deleted) {
      dbLogger.debug('L1 session deleted', { sessionId })
    }

    return deleted
  }

  /**
   * Clean up expired sessions
   * Called periodically to prevent memory leaks
   */
  cleanup(): number {
    const now = new Date()
    let cleaned = 0

    for (const [sessionId, session] of sessions.entries()) {
      if (now > session.expiresAt) {
        sessions.delete(sessionId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      dbLogger.debug('L1 session cleanup', { cleanedCount: cleaned, remainingCount: sessions.size })
    }

    return cleaned
  }

  /**
   * Get all active sessions count
   */
  getActiveCount(): number {
    return sessions.size
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  startCleanupScheduler(intervalMs: number = 5 * 60 * 1000): void {
    if (cleanupInterval) {
      return
    }

    cleanupInterval = setInterval(() => {
      this.cleanup()
    }, intervalMs)

    dbLogger.info('L1 session cleanup scheduler started', { intervalMs })
  }

  /**
   * Stop the cleanup scheduler
   */
  stopCleanupScheduler(): void {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
      dbLogger.info('L1 session cleanup scheduler stopped')
    }
  }
}

// Singleton instance
export const l1SessionService = new L1SessionService()
