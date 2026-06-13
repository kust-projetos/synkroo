/**
 * Conversations Repository Tests
 * Tests core CRUD and query functions using Drizzle
 *
 * Mock pattern: use jest.requireActual inside factory to avoid hoisting issues.
 * Override getDb per-test with mockReturnValue.
 * Use QueryChain class for thenable query results.
 */

jest.mock('@/lib/db/client', () => {
  const actual = jest.requireActual('@/lib/db/client')
  return {
    ...actual,
    getDb: jest.fn(() => actual.getDb()),
  }
})

jest.mock('@/lib/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

import {
  findByClinic,
  findByIdWithJoins,
  countByClinic,
  findMessagesByConversation,
  countMessagesByConversation,
  getLastMessage,
  createMessage,
  updateMessage,
  updateConversation,
  getOrCreateConversation,
  getConversationContext,
  findByExternalId,
} from '../index'

import { getDb } from '@/lib/db/client'

const mockGetDb = getDb as jest.Mock

// ─── Mock helpers ──────────────────────────────────────────────

/**
 * Thenable query result for Drizzle mock.
 * Methods that would be called on the chain return this (self),
 * allowing method chaining. await resolves to rows.
 */
class QueryChain {
  private rows: unknown[]

  constructor(rows: unknown[]) { this.rows = rows }

  then(onfulfilled?: (v: unknown) => void): Promise<unknown[]> {
    return Promise.resolve(this.rows).then(v => {
      if (onfulfilled) onfulfilled(v)
      return v
    })
  }

  // Drizzle query builder methods — all return this for chaining
  from(..._args: unknown[]): this { return this }
  where(..._args: unknown[]): this { return this }
  orderBy(..._args: unknown[]): this { return this }
  limit(..._args: unknown[]): this { return this }
  offset(..._args: unknown[]): this { return this }
  leftJoin(..._args: unknown[]): this { return this }
  rightJoin(..._args: unknown[]): this { return this }
  innerJoin(..._args: unknown[]): this { return this }
  having(..._args: unknown[]): this { return this }
  groupBy(..._args: unknown[]): this { return this }
  update(..._args: unknown[]): this { return this }
  delete(..._args: unknown[]): this { return this }
  set(..._args: unknown[]): this { return this }
  values(..._args: unknown[]): this { return this }
  returning(..._args: unknown[]): this { return this }
}

/**
 * Build a mock select() result for findByClinic chain:
 * select({...}).from().leftJoin().leftJoin().where().orderBy().limit().offset()
 */
function makeFindByClinicChain(rows: unknown[]): Record<string, unknown> {
  const chain = new QueryChain(rows)
  return { from: () => chain }
}

/**
 * Build a simple select chain: select({...}).from().where().orderBy().limit().offset()
 */
function makeSimpleChain(rows: unknown[]): Record<string, unknown> {
  const chain = new QueryChain(rows)
  return { from: () => chain }
}

/**
 * Build a count chain: select().from().where()
 */
function makeCountChain(rows: unknown[]): Record<string, unknown> {
  const chain = new QueryChain(rows)
  return { from: () => chain }
}

/**
 * Build an insert chain: insert().values().returning()
 */
function makeInsertChain(rows: unknown[]): Record<string, unknown> {
  const chain = new QueryChain(rows)
  return { values: () => ({ returning: () => chain }) }
}

/**
 * Build an update chain: update().set().where().returning()
 */
function makeUpdateChain(rows: unknown[]): Record<string, unknown> {
  const chain = new QueryChain(rows)
  return {
    set: () => ({
      where: () => ({ returning: () => chain }),
    }),
  }
}

// ─── Fixtures ──────────────────────────────────────────────────

const mockConversation = {
  id: 'conv-1',
  clinicId: 'clinic-1',
  channel: 'whatsapp',
  status: 'active',
  externalId: '5511999999999',
  lastMessageAt: new Date('2026-06-01T10:00:00Z'),
  messageCount: 5,
  metadata: {},
  createdAt: new Date('2026-06-01T09:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:00Z'),
}

const mockMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  direction: 'inbound',
  content: 'Olá, bom dia!',
  messageType: 'text',
  mediaUrl: null,
  metadata: {},
  intent: 'saudacao',
  entities: {},
  confidence: '0.95',
  isAi: false,
  deliveredAt: new Date('2026-06-01T10:01:00Z'),
  readAt: null,
  createdAt: new Date('2026-06-01T10:01:00Z'),
}

// ─── Tests ─────────────────────────────────────────────────────

describe('Conversations Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('findByClinic', () => {
    it('should return conversations for a clinic', async () => {
      const rows = [{ ...mockConversation, patientId: null, patientName: null, patientPhone: null, assignedUserId: null, assignedUserName: null }]
      mockGetDb.mockReturnValue({ select: () => makeFindByClinicChain(rows) })

      const result = await findByClinic('clinic-1')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('conv-1')
    })

    it('should return empty array when no conversations', async () => {
      mockGetDb.mockReturnValue({ select: () => makeFindByClinicChain([]) })

      const result = await findByClinic('clinic-1')

      expect(result).toEqual([])
    })

    it('should call db.select', async () => {
      mockGetDb.mockReturnValue({ select: () => makeFindByClinicChain([]) })

      await findByClinic('clinic-1')

      expect(getDb).toHaveBeenCalled()
    })
  })

  describe('findByIdWithJoins', () => {
    it('should return conversation with patient and user joins', async () => {
      const row = {
        ...mockConversation,
        patientId: 'patient-1',
        patientName: 'João Silva',
        patientPhone: '5511999999999',
        patientEmail: 'joao@example.com',
        assignedUserId: null,
        assignedUserName: null,
      }
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([row]) })

      const result = await findByIdWithJoins('conv-1', 'clinic-1')

      expect(result).not.toBeNull()
      expect(result!.patient).toEqual({
        id: 'patient-1',
        name: 'João Silva',
        phone: '5511999999999',
        email: 'joao@example.com',
      })
    })

    it('should return null when not found', async () => {
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([]) })

      const result = await findByIdWithJoins('nonexistent', 'clinic-1')

      expect(result).toBeNull()
    })
  })

  describe('countByClinic', () => {
    it('should return count', async () => {
      mockGetDb.mockReturnValue({ select: () => makeCountChain([{ count: 42 }]) })

      const result = await countByClinic('clinic-1')

      expect(result).toBe(42)
    })

    it('should return 0 when no rows', async () => {
      mockGetDb.mockReturnValue({ select: () => makeCountChain([]) })

      const result = await countByClinic('clinic-1')

      expect(result).toBe(0)
    })
  })

  describe('findMessagesByConversation', () => {
    it('should return messages ordered by createdAt asc', async () => {
      const rows = [mockMessage, { ...mockMessage, id: 'msg-2', direction: 'outbound' }]
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain(rows) })

      const result = await findMessagesByConversation('conv-1')

      expect(result).toHaveLength(2)
      expect(result[0].direction).toBe('inbound')
    })

    it('should return empty array when no messages', async () => {
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([]) })

      const result = await findMessagesByConversation('conv-1')

      expect(result).toEqual([])
    })

    it('should support limit and offset', async () => {
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([mockMessage]) })

      await findMessagesByConversation('conv-1', { limit: 10, offset: 0 })

      expect(getDb).toHaveBeenCalled()
    })
  })

  describe('countMessagesByConversation', () => {
    it('should return count', async () => {
      mockGetDb.mockReturnValue({ select: () => makeCountChain([{ count: 10 }]) })

      const result = await countMessagesByConversation('conv-1')

      expect(result).toBe(10)
    })
  })

  describe('getLastMessage', () => {
    it('should return last message content and direction', async () => {
      const rows = [{
        content: 'Última mensagem',
        direction: 'outbound',
        intent: null,
        createdAt: new Date('2026-06-01T12:00:00Z'),
      }]
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain(rows) })

      const result = await getLastMessage('conv-1')

      expect(result).not.toBeNull()
      expect(result!.content).toBe('Última mensagem')
      expect(result!.direction).toBe('outbound')
    })

    it('should return null when no messages', async () => {
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([]) })

      const result = await getLastMessage('conv-1')

      expect(result).toBeNull()
    })
  })

  describe('createMessage', () => {
    it('should create and return message', async () => {
      mockGetDb.mockReturnValue({ insert: () => makeInsertChain([mockMessage]) })

      const result = await createMessage({
        conversationId: 'conv-1',
        direction: 'inbound',
        content: 'Nova mensagem',
      })

      expect(result.id).toBe('msg-1')
      expect(result.content).toBe('Olá, bom dia!')
    })

    it('should create with all optional fields', async () => {
      mockGetDb.mockReturnValue({ insert: () => makeInsertChain([mockMessage]) })

      await createMessage({
        conversationId: 'conv-1',
        direction: 'outbound',
        content: 'Resposta do bot',
        messageType: 'text',
        mediaUrl: 'https://example.com/image.jpg',
        metadata: { delivery_status: 'sent' },
        intent: 'resposta',
        entities: { nome: 'João' },
        confidence: '0.98',
        isAi: true,
      })

      expect(getDb).toHaveBeenCalled()
    })
  })

  describe('updateMessage', () => {
    it('should update and return message', async () => {
      mockGetDb.mockReturnValue({ update: () => makeUpdateChain([{ ...mockMessage, intent: 'agendamento' }]) })

      const result = await updateMessage('msg-1', { intent: 'agendamento' })

      expect(result).not.toBeNull()
    })

    it('should return null when not found', async () => {
      mockGetDb.mockReturnValue({ update: () => makeUpdateChain([]) })

      const result = await updateMessage('nonexistent', { intent: 'agendamento' })

      expect(result).toBeNull()
    })
  })

  describe('updateConversation', () => {
    it('should update conversation fields', async () => {
      mockGetDb.mockReturnValue({ update: () => makeUpdateChain([]) })

      await updateConversation('conv-1', {
        lastMessageAt: new Date(),
        status: 'escalated',
      })

      expect(getDb).toHaveBeenCalled()
    })
  })

  describe('getOrCreateConversation', () => {
    it('should return existing conversation id', async () => {
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([{ id: 'conv-existing' }]) })

      const result = await getOrCreateConversation('clinic-1', 'whatsapp', '5511999999999')

      expect(result).toBe('conv-existing')
    })

    it('should create new conversation when not found', async () => {
      mockGetDb.mockReturnValue({
        select: () => makeSimpleChain([]),
        insert: () => makeInsertChain([{ id: 'conv-new' }]),
      })

      await getOrCreateConversation('clinic-1', 'whatsapp', '5511999999999')

      expect(getDb).toHaveBeenCalled()
    })
  })

  describe('getConversationContext', () => {
    it('should return conversation history with role mapping', async () => {
      // getConversationContext reverses rows: put outbound first so after reverse
      // inbound (mapped to 'user') comes first
      const rows = [
        { role: 'outbound', content: 'Oi! Como posso ajudar?', intent: null },
        { role: 'inbound', content: 'Olá', intent: 'saudacao' },
      ]
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain(rows) })

      const result = await getConversationContext('conv-1', 10)

      expect(result[0].role).toBe('user')
      expect(result[0].content).toBe('Olá')
      expect(result[1].role).toBe('assistant')
    })
  })

  describe('findByExternalId', () => {
    it('should find conversation by externalId', async () => {
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([{ id: 'conv-1' }]) })

      const result = await findByExternalId('clinic-1', 'whatsapp', '5511999999999')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('conv-1')
    })

    it('should return empty when not found', async () => {
      mockGetDb.mockReturnValue({ select: () => makeSimpleChain([]) })

      const result = await findByExternalId('clinic-1', 'whatsapp', 'unknown')

      expect(result).toHaveLength(0)
    })
  })
})