jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))
jest.mock('@/repositories/conversations', () => ({ getOrCreateConversation: jest.fn(), createMessage: jest.fn() }))
jest.mock('@/services/agent/agent.service', () => ({ agent: { processMessage: jest.fn(), storeMessage: jest.fn() } }))
const { getOrCreateConversation, createMessage } = require('@/repositories/conversations')
const { agent } = require('@/services/agent/agent.service')
beforeEach(() => { jest.clearAllMocks() })

import { NextRequest } from 'next/server'
import { POST } from '../../../../app/api/agent/messages/route'

describe('agent/messages', () => {
  it('returns 400 for missing fields', async () => {
    const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({}) }))
    expect(r.status).toBe(400)
  })
  it('returns AI response', async () => {
    getOrCreateConversation.mockResolvedValue('conv1')
    createMessage.mockResolvedValue({ id: 'm1' })
    agent.processMessage.mockResolvedValue({ message: 'Hello!', intent: 'greeting', confidence: 0.9, action: 'reply', shouldEscalate: false, entities: {} })
    agent.storeMessage.mockResolvedValue(undefined)
    const r = await POST(new NextRequest('http://localhost', { method: 'POST', body: JSON.stringify({ clinic_id: 'c1', visitor_id: 'v1', message: 'Hi', channel: 'web' }) }))
    expect(r.status).toBe(200)
    const b = await r.json()
    expect(b.message).toBe('Hello!')
  })
})
