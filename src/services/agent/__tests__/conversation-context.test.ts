/**
 * Tests for Conversation Context Service
 * Migrated from Supabase to Drizzle repositories
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/repositories/conversation-sessions', () => ({
  findByConversationId: jest.fn(),
  createSession: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
}))

import { ConversationContext } from '../conversation-context'
import * as sessionRepo from '@/repositories/conversation-sessions'

describe('Conversation Context Service', () => {
  let context: ConversationContext

  beforeEach(() => {
    jest.clearAllMocks()
    context = new ConversationContext()
  })

  describe('getSession', () => {
    it('should create new session when none exists', async () => {
      ;(sessionRepo.findByConversationId as jest.Mock).mockResolvedValue(null)
      ;(sessionRepo.createSession as jest.Mock).mockResolvedValue({ id: 'conv-1' })
      ;(sessionRepo.updateSession as jest.Mock).mockResolvedValue(null)

      const session = await context.getSession('conv-1')

      expect(session).toBeTruthy()
      expect(session.id).toBe('conv-1')
      expect(session.entries).toEqual([])
      expect(session.extractedInfo).toEqual({})
    })

    it('should load existing valid session', async () => {
      const now = new Date()
      ;(sessionRepo.findByConversationId as jest.Mock).mockResolvedValue({
        id: 'sess-1',
        conversationId: 'conv-1',
        entries: [
          { role: 'user', content: 'olá', timestamp: now.toISOString(), intent: 'greeting' },
        ],
        extractedInfo: { patientName: 'João' },
        createdAt: now,
        lastActivityAt: now,
      })

      const session = await context.getSession('conv-1')

      expect(session.entries).toHaveLength(1)
      expect(session.entries[0].content).toBe('olá')
      expect(session.extractedInfo.patientName).toBe('João')
    })

    it('should expire and recreate session past timeout', async () => {
      const oldActivity = new Date(Date.now() - 60 * 60 * 1000) // 1h ago
      ;(sessionRepo.findByConversationId as jest.Mock).mockResolvedValueOnce({
        id: 'sess-old',
        conversationId: 'conv-old',
        entries: [],
        extractedInfo: {},
        createdAt: oldActivity,
        lastActivityAt: oldActivity,
      })
      ;(sessionRepo.deleteSession as jest.Mock).mockResolvedValue(true)
      ;(sessionRepo.createSession as jest.Mock).mockResolvedValue({ id: 'conv-old' })
      ;(sessionRepo.updateSession as jest.Mock).mockResolvedValue(null)

      const session = await context.getSession('conv-old')

      // Should be a new empty session (old one expired)
      expect(session.entries).toEqual([])
    })
  })

  describe('addMessage', () => {
    it('should add message and persist session', async () => {
      ;(sessionRepo.findByConversationId as jest.Mock).mockResolvedValue(null)
      ;(sessionRepo.createSession as jest.Mock).mockResolvedValue({ id: 'conv-1' })
      ;(sessionRepo.updateSession as jest.Mock).mockResolvedValue(null)

      await context.addMessage('conv-1', 'user', 'Olá, quero agendar', {
        intent: 'agendamento',
        entities: { nome: 'João', data: 'amanhã' },
      })

      expect(sessionRepo.updateSession).toHaveBeenCalled()
    })

    it('should extract important info from entities', async () => {
      ;(sessionRepo.findByConversationId as jest.Mock).mockResolvedValue(null)
      ;(sessionRepo.createSession as jest.Mock).mockResolvedValue({ id: 'conv-1' })
      ;(sessionRepo.updateSession as jest.Mock).mockResolvedValue(null)

      await context.addMessage('conv-1', 'user', 'Olá', {
        entities: { nome: 'Maria', data: 'sexta', hora: '15:00', procedimento: 'clareamento' },
      })

      const updateCall = (sessionRepo.updateSession as jest.Mock).mock.calls[0]
      expect(updateCall[1].extractedInfo).toMatchObject({
        patientName: 'Maria',
        requestedDate: 'sexta',
        requestedTime: '15:00',
        procedure: 'clareamento',
      })
    })
  })

  describe('getContext', () => {
    it('should return role/content pairs from session', async () => {
      const now = new Date()
      ;(sessionRepo.findByConversationId as jest.Mock).mockResolvedValue({
        id: 'sess-1',
        conversationId: 'conv-1',
        entries: [
          { role: 'user', content: 'olá', timestamp: now.toISOString() },
          { role: 'assistant', content: 'como posso ajudar?', timestamp: now.toISOString() },
        ],
        extractedInfo: {},
        createdAt: now,
        lastActivityAt: now,
      })

      const ctx = await context.getContext('conv-1')

      expect(ctx).toHaveLength(2)
      expect(ctx[0]).toEqual({ role: 'user', content: 'olá' })
      expect(ctx[1]).toEqual({ role: 'assistant', content: 'como posso ajudar?' })
    })
  })

  describe('getExtractedInfo', () => {
    it('should return extracted info from session', async () => {
      const now = new Date()
      ;(sessionRepo.findByConversationId as jest.Mock).mockResolvedValue({
        id: 'sess-1',
        conversationId: 'conv-1',
        entries: [],
        extractedInfo: { patientName: 'Maria', requestedDate: 'sexta' },
        createdAt: now,
        lastActivityAt: now,
      })

      const info = await context.getExtractedInfo('conv-1')

      expect(info.patientName).toBe('Maria')
      expect(info.requestedDate).toBe('sexta')
    })
  })

  describe('deleteSession', () => {
    it('should delete session from database', async () => {
      ;(sessionRepo.deleteSession as jest.Mock).mockResolvedValue(true)

      await expect(context.deleteSession('conv-1')).resolves.not.toThrow()
      expect(sessionRepo.deleteSession).toHaveBeenCalledWith('conv-1')
    })
  })
})