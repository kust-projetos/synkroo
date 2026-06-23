/**
 * Integration test: Atendimento module route gates (P0+P3).
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento/__tests__/gates/integration.test.ts
 *
 * Tests:
 *  - withModuleRoute returns 404 when atendimento is disabled (stub manifest)
 *  - withModuleRoute passes through when atendimento is enabled
 *  - Route handlers tested via dynamic import + jest.spyOn on moduleManifest
 *  - P3: invalid signature/secret → 403
 *  - P3: malformed payload → 200 no-op
 *  - P3: duplicate externalMessageId → single message persisted
 *  - P3: handshake GET ok
 */

/** @jest-environment node */

process.env.DATABASE_URL = 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';
process.env.WEBHOOK_SECRET = 'test-gate-secret-32chars-minimum!!';
process.env.WHATSAPP_VERIFY_TOKEN = 'test-wa-token';
process.env.WHATSAPP_APP_SECRET = 'test-wa-app-secret-32chars!!';
process.env.INSTAGRAM_VERIFY_TOKEN = 'test-ig-token';

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { Pool } from 'pg';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';
const describeOrSkip = SKIP ? describe.skip : describe;

const VALID_SECRET = process.env.WEBHOOK_SECRET!;
const CLINIC_ID = '00000000-0000-0000-0000-00000000a001';

// ─── Pool for DB-dependent tests ──────────────────────────────────────────────

let pool: Pool;

beforeAll(async () => {
  if (SKIP) return;
  pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  await pool.query(
    `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
     VALUES ($1, 'Test Clinic Gates', 'test-clinic-gates', '+5500000000001', 'gates@test.local', 'starter', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID],
  );
}, 60_000);

afterAll(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM instance_modules WHERE module_id = 'atendimento'`);
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);
    await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);
  } catch { /* ignore */ }
  await pool.end();
});

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
    async function fakeGET(_req?: NextRequest) { return NextResponse.json({ ok: true }); }
    const gated = withModuleRoute('atendimento', stubDisabled)(fakeGET);
    const req = new NextRequest('http://localhost/api/widget');
    const res = await gated(req);
    expect(res.status).toBe(404);
  });

  it('passes through for GET handler when enabled', async () => {
    async function fakeGET(_req?: NextRequest) { return NextResponse.json({ ok: true }); }
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

// ─── P3: Webhook policy tests ─────────────────────────────────────────────────

const P3_CLINIC_ID = '00000000-0000-0000-0000-00000000b003';

beforeAll(async () => {
  if (SKIP) return;
  // Ensure P3 clinic exists
  await pool!.query(
    `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
     VALUES ($1, 'Test Clinic P3', 'test-clinic-p3', '+5500000000003', 'p3@test.local', 'starter', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [P3_CLINIC_ID],
  );
}, 60_000);

afterAll(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [P3_CLINIC_ID]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [P3_CLINIC_ID]);
    await pool.query(`DELETE FROM clinics WHERE id = $1`, [P3_CLINIC_ID]);
  } catch { /* ignore */ }
});

describeOrSkip('Atendimento routes — P3 webhook policy', () => {

  const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;

  function signBody(body: string): string {
    return 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
  }

  beforeEach(() => {
    jest.spyOn(moduleManifest, 'isEnabled').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Invalid signature → 403 ──────────────────────────────────

  it('whatsapp/webhook POST with missing signature returns 403', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const req = new NextRequest('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('whatsapp/webhook POST with wrong signature returns 403', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const req = new NextRequest('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=wrongsig0000000000000000000000000000000000000000000000000000',
      },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('whatsapp/evolution POST invalid secret returns 403', async () => {
    const { POST } = await import('@/app/api/whatsapp/evolution/route');
    const req = new NextRequest('http://localhost/api/whatsapp/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': 'wrong!!' },
      body: JSON.stringify({ event: 'messages.upsert', data: { key: { remoteJid: 'x', id: 'm1' } } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  // ── Malformed payload → 200 no-op (processor-level) ──────────

  it('whatsapp/webhook POST invalid object type returns 200 (no-op)', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const body = JSON.stringify({ object: 'unknown_type', entry: [] });
    const req = new NextRequest('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signBody(body),
      },
      body,
    });
    const res = await POST(req);
    // Signature valid, gate passes → route guards unknown type → returns 200 with 'ignored'
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ignored');
  });

  it('whatsapp/webhook POST empty entry returns 200 (no-op)', async () => {
    const { POST } = await import('@/app/api/whatsapp/webhook/route');
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const req = new NextRequest('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': signBody(body),
      },
      body,
    });
    const res = await POST(req);
    // Processor returns [] for empty entries → 200
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.processed).toBe(0);
  });

  it('whatsapp/evolution POST no remoteJid returns 200 (no-op)', async () => {
    const { POST } = await import('@/app/api/whatsapp/evolution/route');
    const req = new NextRequest('http://localhost/api/whatsapp/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': VALID_SECRET },
      body: JSON.stringify({ event: 'messages.upsert', data: {} }),
    });
    const res = await POST(req);
    // Gate + auth pass → processor returns [] (no key.remoteJid) → route returns 200
    expect(res.status).toBe(200);
  });

  // ── Handshake GET revalidate ─────────────────────────────────

  it('whatsapp/webhook GET handshake returns challenge text (P3)', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route');
    const url = new URL('http://localhost/api/whatsapp/webhook');
    url.searchParams.set('hub.mode', 'subscribe');
    url.searchParams.set('hub.verify_token', 'test-wa-token');
    url.searchParams.set('hub.challenge', 'p3-challenge');
    const req = new NextRequest(url);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('p3-challenge');
  });

  // ── Duplicate externalMessageId → single message persisted ───

  it('duplicate externalMessageId: only one message is persisted', async () => {
    // Clean up first
    await pool!.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [P3_CLINIC_ID]);
    await pool!.query(`DELETE FROM conversations WHERE clinic_id = $1`, [P3_CLINIC_ID]);

    // Insert a conversation directly
    const { rows: convRows } = await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
      [P3_CLINIC_ID, '+5511999990001'],
    );
    const convId = convRows[0].id;

    const repo = await import('@/modules/atendimento/repositories/conversations-repository');

    // First insert: should succeed (not deduped)
    const result1 = await repo.appendInboundMessageDeduped({
      conversationId: convId,
      content: 'Hello world',
      externalMessageId: 'ext-msg-001',
      metadata: { source: 'whatsapp' },
    });
    expect(result1.deduped).toBe(false);
    expect((result1 as any).id).toBeDefined();

    // Second insert with same externalMessageId: should dedup
    const result2 = await repo.appendInboundMessageDeduped({
      conversationId: convId,
      content: 'Hello again (duplicate)',
      externalMessageId: 'ext-msg-001',
    });
    expect(result2.deduped).toBe(true);

    // Verify only one message exists, and it's the first one
    const { rows: msgRows } = await pool!.query(
      `SELECT id, content FROM messages WHERE conversation_id = $1`,
      [convId],
    );
    expect(msgRows.length).toBe(1);
    expect(msgRows[0].content).toBe('Hello world');
  });
});
