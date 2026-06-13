/**
 * Tests for WhatsApp Webhook API
 * Run: npm test -- webhook.test.ts
 */

import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

const TEST_APP_SECRET = 'test-app-secret'
function computeSignature(body: string): string {
  return 'sha256=' + createHmac('sha256', TEST_APP_SECRET).update(body).digest('hex')
}

// Set APP_SECRET before route module loads its module-level constants
process.env.WHATSAPP_APP_SECRET = TEST_APP_SECRET

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

// Mock getDb for Drizzle — proper chain simulation
jest.mock('@/lib/db/client', () => {
  const mockConversations = [
    { id: 'conv-123', clinicId: 'clinic-123', patientId: null, channel: 'whatsapp', externalId: '5511999999999', status: 'active', assignedTo: null, lastMessageAt: null, messageCount: 0, metadata: {}, createdAt: new Date(), updatedAt: new Date() },
  ]

  function makeQueryBuilder(result: unknown[]) {
    const builder: any = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(result),
      returning: jest.fn().mockImplementation(() => Promise.resolve([{ id: 'conv-123' }])),
    }
    return builder
  }

  function makeInsertBuilder(result: unknown[]) {
    return {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockImplementation(() => Promise.resolve(result)),
    }
  }

  function makeUpdateBuilder() {
    return {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
    }
  }

  return {
    getDb: jest.fn(() => ({
      select: jest.fn().mockImplementation(() => makeQueryBuilder(mockConversations)),
      from: jest.fn().mockImplementation(() => makeQueryBuilder(mockConversations)),
      insert: jest.fn().mockImplementation(() => makeInsertBuilder([{ id: 'msg-123', conversationId: 'conv-123' }])),
      update: jest.fn().mockImplementation(() => makeUpdateBuilder()),
      execute: jest.fn().mockImplementation(() => Promise.resolve({ rows: [{ id: 'clinic-123' }] })),
    })),
  }
})

jest.mock('@/lib/llm', () => ({
  getLLMProvider: () => ({
    classifyIntent: jest.fn().mockResolvedValue({
      intent: 'agendamento',
      confidence: 0.9,
      entities: {},
    }),
    extractEntities: jest.fn().mockResolvedValue({}),
    shouldEscalate: jest.fn().mockResolvedValue(false),
    generateResponse: jest.fn().mockResolvedValue('Olá! Como posso ajudar?'),
  }),
}))

jest.mock('@/services/appointments/confirmation-handler.service', () => ({
  processConfirmationResponse: jest.fn().mockResolvedValue({ processed: false, responseMessage: null }),
  processWaitlistConfirmation: jest.fn().mockResolvedValue({ processed: false, responseMessage: null }),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 99, resetTime: Date.now() + 60000 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: {
    webhook: { windowMs: 60000, maxRequests: 100 },
    api: { windowMs: 60000, maxRequests: 60 },
    auth: { windowMs: 60000, maxRequests: 10 },
    messages: { windowMs: 60000, maxRequests: 30 },
  },
  createRateLimitHeaders: jest.fn(() => ({
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
  })),
}))

global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve('{}'),
})

import { POST, GET } from '../route'

describe('WhatsApp Webhook', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      WHATSAPP_VERIFY_TOKEN: 'synkroo_webhook_token',
      WHATSAPP_APP_SECRET: TEST_APP_SECRET,
      WHATSAPP_ACCESS_TOKEN: 'test_token',
      NODE_ENV: 'development',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('GET (Verification)', () => {
    it('should verify webhook with correct token', async () => {
      const request = new NextRequest(
        new URL('http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=synkroo_webhook_token&hub.challenge=test_challenge')
      )

      const response = await GET(request)
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toBe('test_challenge')
    })

    it('should reject verification with wrong token', async () => {
      const request = new NextRequest(
        new URL('http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=test_challenge')
      )

      const response = await GET(request)

      expect(response.status).toBe(403)
    })
  })

  describe('POST (Message Reception)', () => {
    it('should process text message correctly', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: '123456789' },
              messages: [{
                id: 'wamid.test',
                from: '5511999999999',
                timestamp: '1711534800',
                type: 'text',
                text: { body: 'Quero agendar uma consulta' },
              }],
            },
          }],
        }],
      }
      const body = JSON.stringify(payload)

      const request = new NextRequest('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': computeSignature(body),
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.processed).toBe(1)
    })

    it('should ignore non-whatsapp objects', async () => {
      const payload = {
        object: 'other_object',
        entry: [],
      }
      const body = JSON.stringify(payload)

      const request = new NextRequest('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': computeSignature(body),
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.status).toBe('ignored')
    })

    it('should handle status updates', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              statuses: [{
                id: 'wamid.test',
                status: 'delivered',
                timestamp: '1711534800',
              }],
            },
          }],
        }],
      }
      const body = JSON.stringify(payload)

      const request = new NextRequest('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': computeSignature(body),
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})