/**
 * Contract tests: Instagram webhook fail-closed behaviour.
 *
 * Covers:
 *  - GET: verification token validation
 *  - POST: secret missing → 500
 *  - POST: signature missing → 403
 *  - POST: invalid signature → 403
 *  - POST: valid signature → 200 (module gate permitting)
 *  - Rate limit and env state reset between tests
 */

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { webhook: { windowMs: 60000, maxRequests: 100 } },
}));

jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: { isEnabled: jest.fn().mockResolvedValue(true) },
}));

jest.mock('@/modules/atendimento/services/webhook-processor-service', () => ({
  processInstagramEntry: jest.fn().mockResolvedValue([]),
}));

import { GET, POST } from '@/app/api/instagram/webhook/route';
import { createHmac } from 'crypto';

const VALID_VERIFY_TOKEN = 'test-ig-token-123';
const VALID_APP_SECRET = 'test-app-secret-at-least-32-chars!!';

function setupEnv() {
  process.env.INSTAGRAM_VERIFY_TOKEN = VALID_VERIFY_TOKEN;
  process.env.INSTAGRAM_APP_SECRET = VALID_APP_SECRET;
}

function clearEnv() {
  delete process.env.INSTAGRAM_VERIFY_TOKEN;
  delete process.env.INSTAGRAM_APP_SECRET;
}

function signBody(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function signBuffer(body: Buffer, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

beforeEach(() => {
  jest.clearAllMocks();
  clearEnv();
  setupEnv();
});

afterAll(() => {
  clearEnv();
});

// ── GET /webhook ───────────────────────────────

describe('GET /api/instagram/webhook', () => {
  it('returns 200 with challenge when verification succeeds', async () => {
    const url = 'https://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=' + VALID_VERIFY_TOKEN + '&hub.challenge=random-challenge-123';
    const req = new Request(url);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('random-challenge-123');
  });

  it('returns 403 when verify_token does not match', async () => {
    const url = 'https://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=ch';
    const req = new Request(url);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', async () => {
    const url = 'https://localhost/api/instagram/webhook?hub.mode=unsubscribe&hub.verify_token=' + VALID_VERIFY_TOKEN;
    const req = new Request(url);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when verify_token is missing from env', async () => {
    delete process.env.INSTAGRAM_VERIFY_TOKEN;
    const url = 'https://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=ch';
    const req = new Request(url);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });
});

// ── POST /webhook ──────────────────────────────

describe('POST /api/instagram/webhook', () => {
  it('returns 500 when INSTAGRAM_APP_SECRET is missing', async () => {
    delete process.env.INSTAGRAM_APP_SECRET;

    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signBody(body, VALID_APP_SECRET) },
      body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 403 when x-hub-signature-256 header is missing', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature does not match', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'sha256=invalid' },
      body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature has wrong format (no sha256= prefix)', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'invalid-signature-format' },
      body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 200 when signature is valid', async () => {
    const payload = { object: 'instagram', entry: [] };
    const body = JSON.stringify(payload);
    const signature = signBody(body, VALID_APP_SECRET);

    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature },
      body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });

  // ── Security Task 5: strict signature format ─────────────────────────────

  it.each([
    `sha256=${'G'.repeat(64)}`,      // non-hex char
    `sha256=${'a'.repeat(63)}`,      // truncated (63 chars)
    `sha256=${'a'.repeat(65)}`,      // over-long (65 chars)
    `sha256=${'a'.repeat(64)} `,     // trailing whitespace
    ` sha256=${'a'.repeat(64)}`,     // leading whitespace
  ])('rejects malformed signature %s', async (signature) => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature },
      body,
    });
    expect((await POST(req as any)).status).toBe(403);
  });

  it('rejects when signed bytes differ from submitted bytes', async () => {
    // Sign compact JSON, submit pretty-printed JSON (same semantic content, different bytes)
    const compact = JSON.stringify({ object: 'instagram', entry: [] });
    const pretty = JSON.stringify({ object: 'instagram', entry: [] }, null, 2);
    const signature = signBody(compact, VALID_APP_SECRET);
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature },
      body: pretty,
    });
    expect((await POST(req as any)).status).toBe(403);
  });

  it('verifies a signature calculated over raw binary bytes before JSON parsing', async () => {
    // Raw binary body signed exactly as Buffer; the HMAC must be computed over
    // the raw byte sequence so that a valid raw-body signature is accepted even
    // when the same bytes are not valid UTF-8 JSON.
    const bytes = Buffer.from([0xff, 0xfe, 0x00, 0x61]);
    const signature = signBuffer(bytes, VALID_APP_SECRET);
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature },
      body: bytes,
    });
    // After the raw-byte fix: HMAC passes, then JSON.parse fails → SyntaxError.
    // Before the fix (text-based): HMAC mismatches → 403.
    await expect(POST(req as any)).rejects.toThrow(SyntaxError);
  });

  it('rejects raw binary body signed with wrong bytes', async () => {
    // Sign one binary payload, submit a different binary payload — HMAC must fail.
    const signedBytes = Buffer.from([0xff, 0xfe, 0x00, 0x61]);
    const submittedBytes = Buffer.from([0xff, 0xfe, 0x00, 0x62]); // last byte differs
    const signature = signBuffer(signedBytes, VALID_APP_SECRET);
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signature },
      body: submittedBytes,
    });
    expect((await POST(req as any)).status).toBe(403);
  });

  // ── existing test ─────────────────────────────────────────────────────────

  it('checks secret before rate limiter (secret missing → 500, rate limiter not called)', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    (checkRateLimit as jest.Mock).mockClear();

    delete process.env.INSTAGRAM_APP_SECRET;
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': signBody(body, VALID_APP_SECRET) },
      body,
    });
    await POST(req as any);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});
