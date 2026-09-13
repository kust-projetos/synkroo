/**
 * T9 — harness middleware + RBAC sem mock tautológico
 *
 * Diferente de `middleware.security.test.ts` (que mocka request-guards para isolar
 * branches), este harness exerce `src/middleware.ts` através das implementações
 * REAIS de `exceedsBodyLimit` / `shouldRejectCsrf` / `isPublicPath` — o mock fica
 * restrito à fronteira I/O `next-auth/jwt#getToken`. Prioriza regressões T1 (transporte
 * público mínimo + auth-before-rate-limit observável via middleware) e T8 (rotas
 * legadas exigem sessão; middleware não mascara 401/403 do handler).
 *
 * TDD: falha se alguém reintroduzir curinga PUBLIC_* ou inverter ordem body-limit/CSRF/auth.
 */

import { NextRequest } from 'next/server'

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

// NÃO mockar '@/lib/security/request-guards' — usar implementação real
import { middleware, isPublicPath } from '../middleware'

function makeRequest(pathname: string, init: any & { nextUrlOrigin?: string } = {}): NextRequest {
  const origin = init.nextUrlOrigin ?? 'http://localhost'
  const url = `${origin}${pathname}`
  const { nextUrlOrigin: _ignored, ...reqInit } = init as any
  return new NextRequest(url, reqInit as any)
}

describe('T9 harness — middleware sem mock tautológico (guards reais)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.AUTH_SECRET = 'test-auth-secret-32chars-long-enough-for-jwt'
    ;(process.env as any).NODE_ENV = 'production'
    mockGetToken.mockResolvedValue(null)
  })

  afterEach(() => {
    delete process.env.AUTH_SECRET
  })

  it('exceedsBodyLimit real: content-length > 1_048_576 → 413 antes de auth (sem mock de guard)', async () => {
    const req = makeRequest('/api/patients', {
      method: 'POST',
      headers: { 'content-length': String(2_000_000) },
    })
    const res = await middleware(req)
    expect(res.status).toBe(413)
    expect(await res.text()).toContain('too large')
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('exceedsBodyLimit real: exatamente no limite → não bloqueia, segue para auth (307 sem sessão)', async () => {
    const req = makeRequest('/api/patients', {
      method: 'POST',
      headers: { 'content-length': String(1_048_576) },
    })
    const res = await middleware(req)
    // Não deve ser 413; sem sessão deve cair em 307→/login
    expect(res.status).not.toBe(413)
    expect([307, 308]).toContain(res.status)
  })

  it('shouldRejectCsrf real: POST com cookie de sessão + Origin cross-site → 403 antes de validar token', async () => {
    const req = new NextRequest('http://localhost/api/patients', {
      method: 'POST',
      headers: {
        cookie: 'next-auth.session-token=abc',
        origin: 'https://evil.example',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(403)
    // Cross-site CSRF deve ser negado antes mesmo de consultar JWT
    expect(mockGetToken).not.toHaveBeenCalled()
  })

  it('shouldRejectCsrf real: POST sem cookie de sessão + Origin cross-site → NÃO bloqueia (NextAuth/Widget assinado)', async () => {
    const req = new NextRequest('http://localhost/api/widget/session', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
      },
    })
    const res = await middleware(req)
    // Widget é PUBLIC_EXACT → segue sem exigir sessão, mesmo com origin estranho
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(307)
  })

  it('shouldRejectCsrf real: POST com cookie + Origin same-site → passa (request-guards retorna false)', async () => {
    const req = new NextRequest('http://localhost/api/patients', {
      method: 'POST',
      headers: {
        cookie: 'next-auth.session-token=abc',
        origin: 'http://localhost',
      },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
    // Deve ter consultado JWT porque CSRF não rejeitou
    expect(mockGetToken).toHaveBeenCalled()
  })

  it('GET não é rejeitado por CSRF mesmo com cookie cross-site (método não mutante)', async () => {
    const req = new NextRequest('http://localhost/api/patients', {
      method: 'GET',
      headers: {
        cookie: 'next-auth.session-token=abc',
        origin: 'https://evil.example',
      },
    })
    const res = await middleware(req)
    expect(res.status).not.toBe(403)
  })

  it('isPublicPath real: PUBLIC_EXACT mínimo — curingas não liberam rotas privadas (T1)', () => {
    // Curingas implícitos NÃO devem ser públicas
    expect(isPublicPath('/api/whatsapp/send')).toBe(false)
    expect(isPublicPath('/api/whatsapp/qrcode')).toBe(false)
    expect(isPublicPath('/api/widget/other')).toBe(false)
    // Apenas exatas
    expect(isPublicPath('/api/whatsapp/webhook')).toBe(true)
    expect(isPublicPath('/api/instagram/webhook')).toBe(true)
  })

  it('SIGNED_TRANSPORT real: /api/cron/* e /api/agent/* bypass auth no middleware (handler valida segredo)', async () => {
    for (const p of ['/api/cron/reminders', '/api/cron/smart-triggers', '/api/agent/classify', '/api/messages/inbound']) {
      const req = makeRequest(p, { method: 'POST' })
      const res = await middleware(req)
      expect(res.status).not.toBe(307)
      expect(res.headers.get('location') ?? '').not.toContain('/login')
    }
  })

  it('rota privada legada T8 (/api/budgets/[id]/accept) sem sessão → middleware 307; com sessão mas sem permissão handler dará 403', async () => {
    const anon = makeRequest('/api/budgets/budget-1/accept', { method: 'POST' })
    const anonRes = await middleware(anon)
    expect([307, 308]).toContain(anonRes.status)

    mockGetToken.mockResolvedValueOnce({ sub: 'u1' } as any)
    const authed = makeRequest('/api/budgets/budget-1/accept', { method: 'POST' })
    const authedRes = await middleware(authed)
    // Com sessão, middleware deixa passar — a decisão 403 é do handler (T8)
    expect(authedRes.status).not.toBe(307)
    expect(authedRes.headers.get('location') ?? '').not.toContain('/login')
  })

  it('ordem: body-limit antes de CSRF — payload gigante com CSRF cross-site ainda retorna 413 (não 403)', async () => {
    const req = new NextRequest('http://localhost/api/patients', {
      method: 'POST',
      headers: {
        'content-length': String(5_000_000),
        cookie: 'next-auth.session-token=abc',
        origin: 'https://evil.example',
      },
    })
    const res = await middleware(req)
    expect(res.status).toBe(413)
  })
})
