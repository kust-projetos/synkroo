/**
 * Contract tests: Instagram webhook — raw-bytes HMAC, strict signature, fail-closed.
 *
 * Before fix: HMAC uses request.text() (decoded string).
 * After fix:  HMAC uses Buffer.from(await request.arrayBuffer()) (raw bytes).
 *
 * Run: npx jest src/__tests__/api/instagram/webhook/contract.test.ts
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

/** Sign raw bytes (Buffer) — what Instagram does. */
function signRaw(bodyBytes: Buffer, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(bodyBytes).digest('hex');
}

/** Sign a UTF-8 string (simulating buggy text-mode signing). */
function signText(bodyStr: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(Buffer.from(bodyStr, 'utf-8')).digest('hex');
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
    const url = 'https://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token='
      + VALID_VERIFY_TOKEN + '&hub.challenge=random-challenge-123';
    const req = new Request(url);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('random-challenge-123');
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

// ── POST /webhook — env / setup ────────────────

describe('POST /api/instagram/webhook — env & setup', () => {
  it('returns 500 when INSTAGRAM_APP_SECRET is missing', async () => {
    delete process.env.INSTAGRAM_APP_SECRET;
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': signRaw(Buffer.from(body), VALID_APP_SECRET) }, body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(500);
  });

  it('returns 403 when x-hub-signature-256 header is missing', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', { method: 'POST', body });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('checks secret before rate limiter (secret missing → 500, rate limiter not called)', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    (checkRateLimit as jest.Mock).mockClear();
    delete process.env.INSTAGRAM_APP_SECRET;
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': signRaw(Buffer.from(body), VALID_APP_SECRET) }, body,
    });
    await POST(req as any);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
});

// ── POST /webhook — strict signature format ───

describe('POST /api/instagram/webhook — strict signature format', () => {
  it('returns 403 when signature has non-hex characters', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const sig = 'sha256=' + 'z' + 'a'.repeat(63); // 'z' is non-hex
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature hex is truncated (63 chars)', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const sig = 'sha256=' + 'a'.repeat(63); // 63 hex chars, expected 64
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature hex is mixed with non-hex chars', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const sig = 'sha256=' + 'a'.repeat(32) + 'XX' + 'a'.repeat(30);
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature hex ends with non-hex char', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const sig = 'sha256=' + 'a'.repeat(63) + 'g'; // 'g' is non-hex
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature is too long (extra hex chars)', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const sig = 'sha256=' + 'a'.repeat(65); // 65 hex chars
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when signature lacks sha256= prefix', async () => {
    const body = JSON.stringify({ object: 'instagram', entry: [] });
    const sig = 'a'.repeat(64); // hex without prefix
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 for uppercase hex (case-sensitive HMAC compare)', async () => {
    const payload = { object: 'instagram', entry: [] };
    const body = JSON.stringify(payload);
    const sig = signRaw(Buffer.from(body), VALID_APP_SECRET);
    const upperSig = sig.replace(/[a-f]/g, (c) => c.toUpperCase());
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': upperSig }, body: Buffer.from(body),
    });
    // Regex allows [0-9a-fA-F] but HMAC digest is lowercase;
    // timingSafeEqual on bytes rejects case mismatch → 403
    const res = await POST(req as any);
    expect(res.status).toBe(403);
  });
});

// ── POST /webhook — raw-bytes HMAC ─────────────

describe('POST /api/instagram/webhook — raw bytes HMAC', () => {
  it('returns 403 when body is compact JSON signed but sent with whitespace (bytes differ)', async () => {
    // Instagram signs compact JSON. Attacker sends pretty-printed version.
    const compact  = JSON.stringify({ object: 'instagram', entry: [] });
    const pretty   = JSON.stringify({ object: 'instagram', entry: [] }, null, 2);
    // Signature computed over compact raw bytes
    const sig = signRaw(Buffer.from(compact), VALID_APP_SECRET);
    // Body sent is pretty-printed (different raw bytes)
    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body: pretty,
    });
    const res = await POST(req as any);
    // Raw bytes differ → HMAC should fail → 403
    expect(res.status).toBe(403);
  });

  it('returns controlled 4xx (not 403) for raw invalid bytes with valid HMAC', async () => {
    // Send raw bytes that ARE NOT valid UTF-8 JSON, but the HMAC is computed
    // over those exact raw bytes. HMAC should pass (raw validation), then
    // JSON.parse should fail with a controlled parse error (not 403).
    const rawBytes = Buffer.from([0x80, 0x81, 0x82]); // invalid UTF-8
    const sig = signRaw(rawBytes, VALID_APP_SECRET);

    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json' },
      body: rawBytes,
    });
    const res = await POST(req as any);

    // HMAC validated over raw bytes → passes
    // JSON.parse fails → controlled error, NOT 403
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(500); // should be a 4xx parse error
    expect([400, 422]).toContain(res.status);
  });
});

// ── POST /webhook — valid regression ───────────

describe('POST /api/instagram/webhook — valid', () => {
  it('returns 200 when signature is valid (raw bytes)', async () => {
    const payload = { object: 'instagram', entry: [] };
    const body = JSON.stringify(payload);
    const rawBytes = Buffer.from(body, 'utf-8');
    const sig = signRaw(rawBytes, VALID_APP_SECRET);

    const req = new Request('https://localhost/api/instagram/webhook', {
      method: 'POST', headers: { 'x-hub-signature-256': sig }, body: rawBytes,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
  });
});
