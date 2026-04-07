/**
 * Tests for WhatsApp Webhook API
 * Run: npm test -- whatsapp.webhook.test.ts
 */

import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

const TEST_APP_SECRET = 'test-app-secret'
function computeSignature(body: string): string {
  return 'sha256=' + createHmac('sha256', TEST_APP_SECRET).update(body).digest('hex')
}

// Set APP_SECRET before route module loads its module-level constants
process.env.WHATSAPP_APP_SECRET = TEST_APP_SECRET

// Mock logger
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

// Simple recursive Supabase mock — each method returns a new thenable object
function createChain(data: any): any {
  const obj: any = {
    // Make the object thenable so `await obj` resolves to { data, error }
    then(resolve?: (v: any) => void, _reject?: (e: any) => void) {
      return resolve?.({ data, error: null })
    },
    // .single() returns a Promise (not thenable — explicit Promise)
    single() {
      return Promise.resolve({ data, error: null })
    },
    // Table selection
    from(table: string) {
      const tableData = table === 'clinics' ? { id: 'clinic-123' }
        : table === 'conversations' ? { id: 'conv-123', clinic_id: 'clinic-123' }
        : table === 'messages' ? []  // Array for .map() compatibility
        : { id: 'test-id' }
      return createChain(tableData)
    },
    // Select returns the same chain (table context preserved)
    select() { return obj },
    // Insert returns a new chain (insert result)
    insert() { return createChain(data) },
    // Update returns the same chain
    update() { return obj },
    // Filter methods return the same chain
    eq() { return obj },
    neq() { return obj },
    gt() { return obj },
    gte() { return obj },
    lt() { return obj },
    lte() { return obj },
    like() { return obj },
    ilike() { return obj },
    in() { return obj },
    contains() { return obj },
    containedBy() { return obj },
    range() { return obj },
    // Ordering/pagination return same chain
    order() { return obj },
    limit() { return obj },
    range2() { return obj },
    // Delete
    delete() { return obj },
    // Upsert
    upsert() { return createChain(data) },
    // RPC
    rpc() { return Promise.resolve({ data, error: null }) },
  }
  return obj
}

const mockSupabase = createChain(null)

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => mockSupabase,
}))

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: () => mockSupabase,
}))

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
  processConfirmationResponse: jest.fn().mockResolvedValue({
    processed: false,
    responseMessage: null,
  }),
  processWaitlistConfirmation: jest.fn().mockResolvedValue({
    processed: false,
    responseMessage: null,
  }),
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({
    allowed: true,
    remaining: 99,
    resetTime: Date.now() + 60000,
  })),
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

import { POST, GET } from '../app/api/whatsapp/webhook/route'

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
