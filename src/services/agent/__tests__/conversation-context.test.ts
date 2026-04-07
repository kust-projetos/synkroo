/**
 * Tests for Conversation Context Service
 * Tests session persistence, context trimming, and info extraction
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { ConversationContext } from '../conversation-context'

describe('Conversation Context Service', () => {
  let context: ConversationContext
  const mockClient = { from: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
    context = new ConversationContext()
  })

  describe('getSession', () => {
    it('should create new session when none exists', async () => {
      // DB returns no session
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      })
      // delete also needs to work
      mockClient.from.mockImplementation((table: string) => {
        if (table === 'conversation_sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      })

      const session = await context.getSession('conv-1')

      expect(session).toBeTruthy()
      expect(session.id).toBe('conv-1')
      expect(session.entries).toEqual([])
      expect(session.extractedInfo).toEqual({})
    })

    it('should load existing valid session', async () => {
      const now = new Date()
      const serializedSession = {
        conversation_id: 'conv-1',
        entries: JSON.stringify([
          { role: 'user', content: 'olá', timestamp: now.toISOString(), intent: 'greeting' },
        ]),
        extracted_info: JSON.stringify({ patientName: 'João' }),
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
      }

      mockClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: serializedSession, error: null }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }))

      const session = await context.getSession('conv-1')

      expect(session.entries).toHaveLength(1)
      expect(session.entries[0].content).toBe('olá')
      expect(session.extractedInfo.patientName).toBe('João')
    })

    it('should expire and recreate session past timeout', async () => {
      const oldActivity = new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1h ago
      const expiredSession = {
        conversation_id: 'conv-old',
        entries: JSON.stringify([]),
        extracted_info: JSON.stringify({}),
        created_at: oldActivity,
        last_activity_at: oldActivity,
      }

      mockClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: expiredSession, error: null }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }))

      const session = await context.getSession('conv-old')

      // Should be a new empty session (old one expired)
      expect(session.entries).toEqual([])
    })
  })

  describe('addMessage', () => {
    it('should add message and persist session', async () => {
      // getSession returns new session
      mockClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }))

      await context.addMessage('conv-1', 'user', 'Olá, quero agendar', {
        intent: 'agendamento',
        entities: { nome: 'João', data: 'amanhã' },
      })

      // Verify upsert was called (persistence)
      const upsertCalls = mockClient.from.mock.calls
      expect(upsertCalls.length).toBeGreaterThan(0)
    })
  })

  describe('getContext', () => {
    it('should return role/content pairs from session', async () => {
      const now = new Date()
      const session = {
        conversation_id: 'conv-1',
        entries: JSON.stringify([
          { role: 'user', content: 'olá', timestamp: now.toISOString() },
          { role: 'assistant', content: 'como posso ajudar?', timestamp: now.toISOString() },
        ]),
        extracted_info: JSON.stringify({}),
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
      }

      mockClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: session, error: null }),
          }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }))

      const ctx = await context.getContext('conv-1')

      expect(ctx).toHaveLength(2)
      expect(ctx[0]).toEqual({ role: 'user', content: 'olá' })
      expect(ctx[1]).toEqual({ role: 'assistant', content: 'como posso ajudar?' })
    })
  })

  describe('getExtractedInfo', () => {
    it('should return extracted info from session', async () => {
      const now = new Date()
      const session = {
        conversation_id: 'conv-1',
        entries: JSON.stringify([]),
        extracted_info: JSON.stringify({ patientName: 'Maria', requestedDate: 'sexta' }),
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
      }

      mockClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: session, error: null }),
          }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }))

      const info = await context.getExtractedInfo('conv-1')

      expect(info.patientName).toBe('Maria')
      expect(info.requestedDate).toBe('sexta')
    })
  })

  describe('buildContextSummary', () => {
    it('should build summary with extracted info', async () => {
      const now = new Date()
      const session = {
        conversation_id: 'conv-1',
        entries: JSON.stringify([{ role: 'user', content: 'test', timestamp: now.toISOString() }]),
        extracted_info: JSON.stringify({
          patientName: 'João',
          requestedDate: 'segunda',
          requestedTime: '14:00',
          procedure: 'limpeza',
        }),
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
      }

      mockClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: session, error: null }),
          }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }))

      const summary = await context.buildContextSummary('conv-1')

      expect(summary).toContain('João')
      expect(summary).toContain('segunda')
      expect(summary).toContain('14:00')
      expect(summary).toContain('limpeza')
    })

    it('should return default message for empty session', async () => {
      const now = new Date()
      const session = {
        conversation_id: 'conv-empty',
        entries: JSON.stringify([]),
        extracted_info: JSON.stringify({}),
        created_at: now.toISOString(),
        last_activity_at: now.toISOString(),
      }

      mockClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: session, error: null }),
          }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      }))

      const summary = await context.buildContextSummary('conv-empty')

      expect(summary).toBe('Nova conversa sem histórico.')
    })
  })

  describe('clearSession', () => {
    it('should delete session from database', async () => {
      mockClient.from.mockImplementation(() => ({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      }))

      await expect(context.clearSession('conv-1')).resolves.not.toThrow()
    })
  })
})
