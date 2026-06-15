jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))
jest.mock('@/repositories/conversations', () => ({ findById: jest.fn(), findMessagesByConversation: jest.fn(), updateConversation: jest.fn() }))
const { findById, findMessagesByConversation } = require('@/repositories/conversations')
beforeEach(() => { jest.clearAllMocks() })
import { l4ConversationService } from '../L4-conversation.service'

describe('L4ConversationService', () => {
  it('returns null when not found', async () => {
    findById.mockResolvedValue(null)
    const r = await l4ConversationService.getById('c1')
    expect(r).toBeNull()
  })
  it('returns conversation with messages', async () => {
    findById.mockResolvedValue({ id: 'conv1', clinicId: 'c1', channel: 'web', status: 'active', externalId: 'v1', patientId: null })
    findMessagesByConversation.mockResolvedValue([{ id: 'm1', direction: 'inbound', content: 'Hello', createdAt: new Date(), messageType: 'text' }])
    const r = await l4ConversationService.getById('c1')
    expect(r?.conversationId).toBe('conv1')
    expect(r?.messages).toHaveLength(1)
  })
})
