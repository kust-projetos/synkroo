import { NextRequest, NextResponse } from 'next/server'

const mockCheckRateLimit = jest.fn()
const mockGetClientIdentifier = jest.fn()
const mockRunAtendimentoAction = jest.fn()

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIdentifier: (...args: unknown[]) => mockGetClientIdentifier(...args),
  rateLimitPresets: { messages: { windowMs: 60_000, maxRequests: 30 } },
}))
jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (handler: unknown) => handler,
}))
jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({}),
}))
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoAction: (...args: unknown[]) => mockRunAtendimentoAction(...args),
}))
jest.mock('@/modules/atendimento/actions/enviar-mensagem', () => ({
  enviarMensagem: { name: 'atendimento.enviarMensagem' },
}))

import { POST } from './route'

function request(body: unknown) {
  return new NextRequest('http://localhost/api/messages/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetClientIdentifier.mockReturnValue('198.51.100.10')
  mockCheckRateLimit.mockReturnValue({
    allowed: true,
    remaining: 29,
    resetTime: Date.now() + 60_000,
  })
  mockRunAtendimentoAction.mockResolvedValue(
    NextResponse.json({ data: { ok: true } }, { status: 201 }),
  )
})

describe('POST /api/messages/send', () => {
  it('delegates to the atendimento action when under the limit', async () => {
    const body = { conversationId: 'conv-1', message: 'Olá' }

    const response = await POST(request(body))

    expect(response.status).toBe(201)
    expect(mockRunAtendimentoAction).toHaveBeenCalledTimes(1)
    expect(mockRunAtendimentoAction).toHaveBeenCalledWith(
      expect.anything(),
      body,
      { okStatus: 201 },
    )
  })

  it('returns 429 with Retry-After header only when the messages limit is exceeded', async () => {
    mockCheckRateLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      retryAfter: 18,
    })

    const response = await POST(request({ conversationId: 'conv-1', message: 'Olá' }))

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('18')
    expect(await response.json()).toEqual({
      error: expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
    })
    expect(mockRunAtendimentoAction).not.toHaveBeenCalled()
  })
})
