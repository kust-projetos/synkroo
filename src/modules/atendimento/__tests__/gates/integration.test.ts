/**
 * Integration test: Atendimento module route gates (P0).
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento/__tests__/gates/integration.test.ts
 *
 * Tests:
 *  - withModuleRoute returns 404 when atendimento is disabled (stub manifest)
 *  - withModuleRoute passes through when atendimento is enabled
 *  - verifyEvolutionSecret rejects invalid/missing secrets, passes valid
 *  - Route handlers are tested via dynamic import + jest.spyOn on moduleManifest
 */

/** @jest-environment node */

process.env.DATABASE_URL = 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';
process.env.WEBHOOK_SECRET = 'test-gate-secret-32chars-minimum!!';
process.env.WHATSAPP_VERIFY_TOKEN = 'test-wa-token';
process.env.INSTAGRAM_VERIFY_TOKEN = 'test-ig-token';

import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';
const describeOrSkip = SKIP ? describe.skip : describe;

const VALID_SECRET = process.env.WEBHOOK_SECRET!;

// ─── Stub manifests ───────────────────────────────────────────────────────────

function makeStubManifest(enabledModules: Set<string>) {
  return {
    async isEnabled(id: string) { return enabledModules.has(id); },
    async enabledModules() { return new Set(enabledModules); },
  };
}

const stubEnabled = makeStubManifest(new Set(['atendimento', 'core']));
const stubDisabled = makeStubManifest(new Set(['core']));

// ─── Fake handlers for gate tests ─────────────────────────────────────────────

async function fakeHandler(_req: NextRequest) {
  return NextResponse.json({ ok: true });
}

async function fakeGET(_req?: NextRequest) {
  return NextResponse.json({ ok: true });
}

// ─── Tests: withModuleRoute gate behavior ─────────────────────────────────────

describe('withModuleRoute — atendimento module gate (P0)', () => {

  it('returns 404 when atendimento is disabled', async () => {
    const gated = withModuleRoute('atendimento', stubDisabled)(fakeHandler);
    const req = new NextRequest('http://localhost/api/test');
    const res = await gated(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not_found');
  });

  it('passes through when atendimento is enabled', async () => {
    const gated = withModuleRoute('atendimento', stubEnabled)(fakeHandler);
    const req = new NextRequest('http://localhost/api/test');
    const res = await gated(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('passes route params through when enabled', async () => {
    async function handlerWithParams(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
      const { id } = await ctx.params;
      return NextResponse.json({ id });
    }
    const gated = withModuleRoute('atendimento', stubEnabled)(handlerWithParams);
    const req = new NextRequest('http://localhost/api/conversations/uuid-abc');
    const res = await gated(req, { params: Promise.resolve({ id: 'uuid-abc' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'uuid-abc' });
  });

  it('returns 404 for GET handler when disabled', async () => {
    const gated = withModuleRoute('atendimento', stubDisabled)(fakeGET);
    const req = new NextRequest('http://localhost/api/widget');
    const res = await gated(req);
    expect(res.status).toBe(404);
  });

  it('passes through for GET handler when enabled', async () => {
    const gated = withModuleRoute('atendimento', stubEnabled)(fakeGET);
    const req = new NextRequest('http://localhost/api/widget');
    const res = await gated(req);
    expect(res.status).toBe(200);
  });
});

// ─── Tests: Route-level integration (module enabled → passes through) ─────────

describeOrSkip('Atendimento routes — module enabled (P0)', () => {

  beforeEach(() => {
    jest.spyOn(moduleManifest, 'isEnabled').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── whatsapp/webhook GET handshake ──
  it('whatsapp/webhook GET returns challenge text when valid token', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route');
    const url = new URL('http://localhost/api/whatsapp/webhook');
    url.searchParams.set('hub.mode', 'subscribe');
    url.searchParams.set('hub.verify_token', 'test-wa-token');
    url.searchParams.set('hub.challenge', 'ch123');
    const req = new NextRequest(url);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('ch123');
  });

  // ── instagram/webhook GET handshake ──
  it('instagram/webhook GET returns challenge text when valid token', async () => {
    const { GET } = await import('@/app/api/instagram/webhook/route');
    const url = new URL('http://localhost/api/instagram/webhook');
    url.searchParams.set('hub.mode', 'subscribe');
    url.searchParams.set('hub.verify_token', 'test-ig-token');
    url.searchParams.set('hub.challenge', 'ch456');
    const req = new NextRequest(url);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('ch456');
  });

  // ── messages/inbound missing fields → 400 (contract preserved) ──
  it('messages/inbound POST missing required fields returns 400', async () => {
    const { POST } = await import('@/app/api/messages/inbound/route');
    const req = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': VALID_SECRET,
      },
      body: JSON.stringify({ incomplete: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  // ── whatsapp/evolution invalid secret → 403 ──
  it('whatsapp/evolution POST invalid secret returns 403', async () => {
    const { POST } = await import('@/app/api/whatsapp/evolution/route');
    const req = new NextRequest('http://localhost/api/whatsapp/evolution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': 'wrong-secret!!',
      },
      body: JSON.stringify({ event: 'messages.upsert', instance: 'test', data: { key: { remoteJid: 'test', id: 'msg1' } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // ── whatsapp/evolution missing secret → 403 ──
  it('whatsapp/evolution POST no secret header returns 403', async () => {
    const { POST } = await import('@/app/api/whatsapp/evolution/route');
    const req = new NextRequest('http://localhost/api/whatsapp/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'messages.upsert', instance: 'test', data: { key: { remoteJid: 'test', id: 'msg2' } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // ── whatsapp/evolution valid secret passes gate + auth ──
  it('whatsapp/evolution POST valid secret passes gate and auth', async () => {
    const { POST } = await import('@/app/api/whatsapp/evolution/route');
    const req = new NextRequest('http://localhost/api/whatsapp/evolution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': VALID_SECRET,
      },
      body: JSON.stringify({ event: 'messages.upsert', instance: 'test', data: { key: { remoteJid: 'test', id: 'msg3' } } }),
    });
    const res = await POST(req);
    // Gate passed → handler runs; should not be 404 (gate) or 403 (auth)
    expect(res.status).not.toBe(404);
    expect(res.status).not.toBe(403);
  });

  // ── widget/messages GET passes through gate ──
  it('widget/messages GET returns JSON when enabled', async () => {
    const { GET } = await import('@/app/api/widget/messages/route');
    const res = await GET();
    expect(res.status).not.toBe(404);
  });
});

// ─── Tests: Module disabled → routes return 404 ───────────────────────────────

describeOrSkip('Atendimento routes — module disabled returns 404 (P0)', () => {

  beforeEach(() => {
    jest.spyOn(moduleManifest, 'isEnabled').mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('messages/inbound POST returns 404', async () => {
    const { POST } = await import('@/app/api/messages/inbound/route');
    const req = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': VALID_SECRET },
      body: JSON.stringify({ clinicId: 'c1', from: '+5511', message: 'hi' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('widget/messages GET returns 404', async () => {
    const { GET } = await import('@/app/api/widget/messages/route');
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('widget/messages POST returns 404', async () => {
    const { POST } = await import('@/app/api/widget/messages/route');
    const req = new NextRequest('http://localhost/api/widget/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clinicId: 'c1', message: 'hi' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('whatsapp/webhook GET returns 404', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route');
    const req = new NextRequest('http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=t&hub.challenge=c');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('whatsapp/webhook POST returns 404', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const req = new NextRequest('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: 'whatsapp_business_account', entry: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('instagram/webhook GET returns 404', async () => {
    const { GET } = await import('@/app/api/instagram/webhook/route');
    const req = new NextRequest('http://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=t&hub.challenge=c');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('instagram/webhook POST returns 404', async () => {
    const { POST } = await import('@/app/api/instagram/webhook/route');
    const req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ object: 'instagram', entry: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('whatsapp/evolution POST returns 404', async () => {
    const { POST } = await import('@/app/api/whatsapp/evolution/route');
    const req = new NextRequest('http://localhost/api/whatsapp/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': VALID_SECRET },
      body: JSON.stringify({ event: 'messages.upsert', instance: 'test', data: { key: { remoteJid: 't', id: 'm1' } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
