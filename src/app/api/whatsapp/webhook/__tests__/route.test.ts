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

jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({
      isEnabled: jest.fn().mockResolvedValue(true), enabledModules: jest.fn() }),
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

jest.mock('@/services/appointments/confirmation-handler.service', () => ({
  processConfirmationResponse: jest.fn().mockResolvedValue({ processed: false, responseMessage: null }),
  processWaitlistConfirmation: jest.fn().mockResolvedValue({ processed: false, responseMessage: null }),
}))

jest.mock('@/modules/atendimento/repositories/conversations-repository', () => ({
  getClinicByPhoneNumber: jest.fn().mockResolvedValue('clinic-123'),
  getClinicByInstance: jest.fn().mockResolvedValue('clinic-123'),
  findOrCreateConversation: jest.fn().mockResolvedValue({ id: 'conv-123', clinicId: 'clinic-123' }),
  appendInboundMessageDeduped: jest.fn().mockResolvedValue({ deduped: false, id: 'msg-123' }),
  updateConversationTimestamp: jest.fn().mockResolvedValue(undefined),
  appendOutboundMessage: jest.fn().mockResolvedValue({ id: 'msg-out-123' }),
  findAppointmentById: jest.fn().mockResolvedValue([{ id: 'appt-1' }]),
  updateAppointmentStatus: jest.fn().mockResolvedValue(undefined),
  getClinicByInstagramAccountId: jest.fn().mockResolvedValue(null),
  messageExistsById: jest.fn().mockResolvedValue(false),
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

// Mock IA channel modules to avoid loading @opennextjs/cloudflare (ESM, Jest breaks).
jest.mock('@/core/ia-channel/agent-invoker', () => ({
  invokeAgentWithEnv: jest.fn(),
  invokeAgent: jest.fn().mockResolvedValue({ reply: '', turnsUsed: 0 }),
}))
jest.mock('@/core/ia-channel/webhook-router', () => ({
  routeInboundToAgent: jest.fn().mockResolvedValue({ from: '5511999999999', action: 'agent_replied' }),
}))
jest.mock('@/core/ia-channel/interlocutor', () => ({
  resolveInterlocutor: jest.fn().mockResolvedValue({ personaType: 'recepcao', context: '', peerId: '5511' }),
  resolveFuncionario: jest.fn(),
}))
jest.mock('@/repositories/patients', () => ({ findPatientByPhone: jest.fn().mockResolvedValue(null) }))
jest.mock('@/core/actions/run', () => ({ runAction: jest.fn().mockResolvedValue({ ok: true, data: { messageId: 'msg-123' } }) }))
jest.mock('@/core/actions/context', () => ({ buildSystemContext: jest.fn().mockResolvedValue({ source: 'system', clinicId: 'c1', can: () => true, hasModule: () => true, audit: { actor: 'agente (sistema)' } }) }))
jest.mock('@/modules/atendimento/actions/enviar-mensagem', () => ({
  enviarMensagem: { name: 'atendimento.enviarMensagem', module: 'atendimento', requires: 'atendimento:manage_messages', label: 'Enviar mensagem', input: { parse: () => ({}) } },
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

    it('T1 b: invalid signature does not consume rate quota (auth before limiter)', async () => {      const { checkRateLimit } = jest.requireMock('@/lib/rate-limit') as { checkRateLimit: jest.Mock }
      checkRateLimit.mockClear()
      const payload = { object: 'whatsapp_business_account', entry: [] }
      const body = JSON.stringify(payload)
      const invalidReq = new NextRequest('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'sha256=invalidsignature',
        },
      })
      const invalidRes = await POST(invalidReq)
      expect(invalidRes.status).toBe(403)
      expect(checkRateLimit).not.toHaveBeenCalled()

      const validReq = new NextRequest('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': computeSignature(body),
        },
      })
      const validRes = await POST(validReq)
      // valid with ignored payload returns 200 (status ignored or success) but not 429/403
      expect([200].includes(validRes.status)).toBe(true)
      expect(checkRateLimit).toHaveBeenCalledTimes(1)
    })

    it('review D2D3: signed but unprocessable media → 200 ignored (no provider retry)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: '123456789' },
              messages: [{
                id: 'wamid.unprocessable',
                from: '5511999999999',
                timestamp: '1711534800',
                type: 'image',
                // sem chave `image` → parseMetaMessage null, evento identificado
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
      expect(data.status).toBe('ignored')
    })

    it('review D2D3 residual: message without sender/mid → 200 ignored (assinatura válida, sem retry)', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: '123456789' },
              messages: [{
                id: 'wamid.nofrom',
                timestamp: '1711534800',
                type: 'text',
                text: { body: 'oi' },
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
      expect(data.status).toBe('ignored')
    })

    it('review D2D3 residual: unknown installation → 200 ignored + warn (assinatura válida)', async () => {
      const { logger } = jest.requireMock('@/lib/logger') as { logger: { warn: jest.Mock } }
      logger.warn.mockClear()
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              // sem phone_number_id → instalação não resolvível
              metadata: {},
              messages: [{
                id: 'wamid.noinst',
                from: '5511999999999',
                timestamp: '1711534800',
                type: 'text',
                text: { body: 'oi' },
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
      expect(data.status).toBe('ignored')
      expect(logger.warn).toHaveBeenCalledWith(
        'whatsapp webhook change ignored',
        expect.objectContaining({ event: 'unknown_installation' }),
      )
    })

    it('review D2D3 residual: action failure → 200 ignored + warn (sem 422/500, sem retry)', async () => {
      const { logger } = jest.requireMock('@/lib/logger') as { logger: { warn: jest.Mock } }
      logger.warn.mockClear()
      const { runAction } = jest.requireMock('@/core/actions/run') as { runAction: jest.Mock }
      runAction.mockResolvedValueOnce({ ok: false, error: { code: 'internal', message: 'boom' } })
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: '123456789' },
              messages: [{
                id: 'wamid.actionfail',
                from: '5511999999999',
                timestamp: '1711534800',
                type: 'text',
                text: { body: 'oi' },
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
      expect(data.status).toBe('ignored')
      expect(logger.warn).toHaveBeenCalledWith(
        'whatsapp webhook message ignored',
        expect.objectContaining({ event: 'action_failed' }),
      )
    })

    it('review D2D3 residual: structurally invalid JSON body → 400 (preservado, antes da identificação)', async () => {
      const body = 'not-json{{{'

      const request = new NextRequest('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': computeSignature(body),
        },
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
    })

    it('review D2D3 definitivo: rate limit pós-assinatura → 200 ignored (sem 429, sem retry)', async () => {
      const { logger } = jest.requireMock('@/lib/logger') as { logger: { warn: jest.Mock } }
      logger.warn.mockClear()
      const { checkRateLimit } = jest.requireMock('@/lib/rate-limit') as { checkRateLimit: jest.Mock }
      checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() + 60000 })
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: '123456789' },
              messages: [{
                id: 'wamid.ratelimited',
                from: '5511999999999',
                timestamp: '1711534800',
                type: 'text',
                text: { body: 'oi' },
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
      expect(data.status).toBe('ignored')
      expect(logger.warn).toHaveBeenCalledWith(
        'whatsapp webhook ignored',
        expect.objectContaining({ event: 'rate_limited' }),
      )
    })

    it('review D2D3 definitivo: exceção da action → lote continua (2ª processada) e 200', async () => {
      const { logger } = jest.requireMock('@/lib/logger') as { logger: { warn: jest.Mock } }
      logger.warn.mockClear()
      const { runAction } = jest.requireMock('@/core/actions/run') as { runAction: jest.Mock }
      runAction.mockRejectedValueOnce(new Error('db down'))
      const payload = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: '123456789' },
              messages: [
                {
                  id: 'wamid.throw1',
                  from: '5511999999999',
                  timestamp: '1711534800',
                  type: 'text',
                  text: { body: 'primeira' },
                },
                {
                  id: 'wamid.ok2',
                  from: '5511999999999',
                  timestamp: '1711534801',
                  type: 'text',
                  text: { body: 'segunda' },
                },
              ],
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
      expect(data.ignored).toBe(1)
      expect(logger.warn).toHaveBeenCalledWith(
        'whatsapp webhook message ignored',
        expect.objectContaining({ event: 'action_exception' }),
      )
    })

    it('review D2D3 definitivo: warns sem phoneNumberId em nenhum warn do lote', async () => {
      const { logger } = jest.requireMock('@/lib/logger') as { logger: { warn: jest.Mock } }
      logger.warn.mockClear()
      const { runAction } = jest.requireMock('@/core/actions/run') as { runAction: jest.Mock }
      runAction.mockRejectedValueOnce(new Error('db down'))
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [{
              value: {
                metadata: {},
                messages: [{
                  id: 'wamid.noinst2',
                  from: '5511999999999',
                  timestamp: '1711534800',
                  type: 'text',
                  text: { body: 'oi' },
                }],
              },
            }],
          },
          {
            changes: [{
              value: {
                metadata: { phone_number_id: '123456789' },
                messages: [{
                  id: 'wamid.throw2',
                  from: '5511999999999',
                  timestamp: '1711534801',
                  type: 'text',
                  text: { body: 'oi' },
                }],
              },
            }],
          },
        ],
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
      expect(response.status).toBe(200)
      expect(logger.warn.mock.calls.length).toBeGreaterThan(0)
      for (const call of logger.warn.mock.calls) {
        expect(call[1]).not.toHaveProperty('phoneNumberId')
      }
    })
  })
})