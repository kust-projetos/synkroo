/**
 * T1 — middleware transportes públicos e cron DoS (merged with original tranche)
 * Preserva testes originais de security gates e adiciona cobertura T1 para
 * webhook/widget exatos, curingas bloqueados e auth-before-rate-limit.
 */

import { NextRequest, NextResponse } from 'next/server';

const mockGetToken = jest.fn();
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => mockGetToken(...args),
}));

jest.mock('@/lib/security/request-guards', () => ({
  exceedsBodyLimit: jest.fn(() => false),
  shouldRejectCsrf: jest.fn(() => false),
}));

import { middleware, isPublicPath } from '../middleware';
import { exceedsBodyLimit as _exceeds, shouldRejectCsrf as _reject } from '@/lib/security/request-guards';
const mockExceedsBodyLimit = _exceeds as jest.MockedFunction<typeof _exceeds>;
const mockShouldRejectCsrf = _reject as jest.MockedFunction<typeof _reject>;

// Helper para criar NextRequest com pathname específico
function makeRequest(pathname: string, init?: RequestInit): NextRequest {
  const url = `http://localhost${pathname}`;
  // @ts-expect-error NextRequest accepts RequestInit
  return new NextRequest(url, init);
}

describe('middleware security gates — original (preserved)', () => {
  it.each([
    ['/api/health', true],
    ['/api/auth/signin', true],
    ['/api/whatsapp/evolution', true],
    ['/api/messages/inbound', false],
    ['/api/messages/send', false],
    ['/api/cron/cleanup', false],
    ['/api/agent/classify', false],
  ])('classifies %s as public=%s', (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });

  it('rejects cross-origin cookie mutations before route handling', async () => {
    mockShouldRejectCsrf.mockReturnValueOnce(true);
    const request = new NextRequest('https://app.example.test/api/action', {
      method: 'POST',
      headers: {
        cookie: 'next-auth.session-token=token',
        origin: 'https://evil.example',
      },
    });
    const response = await middleware(request);
    expect(response.status).toBe(403);
    mockShouldRejectCsrf.mockReset();
    mockShouldRejectCsrf.mockReturnValue(false);
  });
  it('leaves NextAuth mutations to NextAuth CSRF validation', async () => {
    mockGetToken.mockResolvedValue({ id: 'user-1' } as any);
    const request = new NextRequest('https://app.example.test/api/auth/signout', {
      method: 'POST',
      headers: {
        cookie: 'next-auth.session-token=token',
        origin: 'https://evil.example',
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
  });
  it('rejects request bodies above the platform limit before authentication', async () => {
    mockExceedsBodyLimit.mockReturnValueOnce(true);
    const request = new NextRequest('https://app.example.test/api/action', {
      method: 'POST',
      headers: {
        'content-length': String(1_048_577),
      },
    });
    const response = await middleware(request);
    expect(response.status).toBe(413);
    mockExceedsBodyLimit.mockReset();
    mockExceedsBodyLimit.mockReturnValue(false);
  });
});

describe('isPublicPath — PUBLIC_EXACT mínimo sem curingas (T1)', () => {
  it('retorna true para rotas públicas exatas', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/whatsapp/evolution')).toBe(true);
    expect(isPublicPath('/api/financeiro/webhooks/asaas')).toBe(true);
  });

  it('retorna true para os novos transportes externos exatos de T1', () => {
    expect(isPublicPath('/api/whatsapp/webhook')).toBe(true);
    expect(isPublicPath('/api/instagram/webhook')).toBe(true);
    expect(isPublicPath('/api/widget/session')).toBe(true);
    expect(isPublicPath('/api/widget/messages')).toBe(true);
  });

  it('não libera curingas: /api/whatsapp/* e /api/widget/* fora da lista não são públicas', () => {
    expect(isPublicPath('/api/whatsapp/send')).toBe(false);
    expect(isPublicPath('/api/whatsapp/qrcode')).toBe(false);
    expect(isPublicPath('/api/whatsapp/templates')).toBe(false);
    expect(isPublicPath('/api/widget/other')).toBe(false);
    expect(isPublicPath('/api/widget/messages/extra')).toBe(false);
    expect(isPublicPath('/api/widget')).toBe(false);
  });

  it('prefixo /api/auth/callback/ é público, mas outras /api/* não', () => {
    expect(isPublicPath('/api/auth/callback/provider')).toBe(true);
    expect(isPublicPath('/api/patients')).toBe(false);
    expect(isPublicPath('/api/appointments')).toBe(false);
  });
});

describe('middleware — transportes legítimos vs rota privada (T1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExceedsBodyLimit.mockReturnValue(false);
    mockShouldRejectCsrf.mockReturnValue(false);
    process.env.AUTH_SECRET = 'test-auth-secret-32chars-long-enough';
    (process.env as any).NODE_ENV = 'production';
    mockGetToken.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it('sem sessão, webhook WhatsApp chega ao handler (NextResponse.next) sem 307', async () => {
    const req = makeRequest('/api/whatsapp/webhook', { method: 'POST' });
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(302);
    const location = res.headers.get('location') ?? '';
    expect(location).not.toContain('/login');
  });

  it('sem sessão, webhook Instagram chega ao handler sem 307', async () => {
    const req = makeRequest('/api/instagram/webhook', { method: 'POST' });
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location') ?? '').not.toContain('/login');
  });

  it('sem sessão, widget session/messages chegam ao handler sem 307', async () => {
    for (const path of ['/api/widget/session', '/api/widget/messages']) {
      const req = makeRequest(path, { method: 'POST' });
      const res = await middleware(req);
      expect(res.status).not.toBe(307);
      expect(res.headers.get('location') ?? '').not.toContain('/login');
    }
  });

  it('sem sessão, SIGNED_TRANSPORT cron chega ao handler sem 307 (validação será no handler)', async () => {
    const req = makeRequest('/api/cron/reminders', { method: 'POST' });
    const res = await middleware(req);
    expect(res.status).not.toBe(307);
    expect(res.headers.get('location') ?? '').not.toContain('/login');
  });

  it('sem sessão, rota privada redireciona para /login (307)', async () => {
    const req = makeRequest('/api/patients', { method: 'GET' });
    const res = await middleware(req);
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('sem sessão, /api/whatsapp/send (não listado) continua protegida', async () => {
    const req = makeRequest('/api/whatsapp/send', { method: 'POST' });
    const res = await middleware(req);
    expect([307, 308]).toContain(res.status);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('com sessão válida, rota privada avança (next) e /login redireciona para /dashboard', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user-1' } as any);
    const privateReq = makeRequest('/api/patients', { method: 'GET' });
    const privateRes = await middleware(privateReq);
    expect(privateRes.status).not.toBe(307);
    expect(privateRes.headers.get('location') ?? '').not.toContain('/login');

    const loginReq = makeRequest('/login', { method: 'GET' });
    const loginRes = await middleware(loginReq);
    expect([307, 308]).toContain(loginRes.status);
    expect(loginRes.headers.get('location')).toContain('/dashboard');
  });

  it('assinatura ausente/inválida ainda chega ao handler (middleware não valida HMAC; handler nega efeito)', async () => {
    const reqWithoutSig = makeRequest('/api/whatsapp/webhook', { method: 'POST' });
    const res = await middleware(reqWithoutSig);
    expect(res.headers.get('location') ?? '').not.toContain('/login');
    expect(res.status).not.toBe(307);
  });
});

describe('middleware — /api/seed continua transportAuth (handler valida SEED_SECRET)', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-secret';
    (process.env as any).NODE_ENV = 'production';
    mockGetToken.mockResolvedValue(null);
  });

  it('sem sessão, /api/seed não redireciona (seed valida SEED_SECRET no handler)', async () => {
    const req = makeRequest('/api/seed', { method: 'POST' });
    const res = await middleware(req);
    expect(res.headers.get('location') ?? '').not.toContain('/login');
  });
});
