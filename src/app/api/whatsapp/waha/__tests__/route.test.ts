/**
 * POST /api/whatsapp/waha — inbound WAHA webhook (vNext P3.3, DORMANT).
 *
 * Contract under test (security advisory):
 *   - server-only HMAC key read INSIDE the handler, fail-closed, no dev bypass;
 *   - HMAC verified over the ACTUAL raw bytes, BEFORE any JSON parse;
 *   - strict algorithm header + 128 hex chars signature;
 *   - session (never clinicId) resolves the installation via the `waha` provider;
 *   - only `message` + `fromMe === false` + direct `<digits>@c.us` sender;
 *   - session-scoped dedup id, allowlisted metadata, bounded content;
 *   - minimal acks and leak-free logs.
 */
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

const mockResolveWahaInstallationStrict = jest.fn();
const mockRunAtendimentoSystemActionResult = jest.fn();
const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// The REAL `withModuleRoute` gate is exercised here (only the manifest behind it
// is mocked), so the tests prove the gate still runs — and that it runs only
// AFTER authentication, not before it.
const mockCreateManifest = jest.fn();
const mockIsEnabled = jest.fn(async () => true);
jest.mock('@/core/modules/manifest', () => ({
  createManifest: (...args: unknown[]) => mockCreateManifest(...args),
}));

jest.mock('@/modules/atendimento/integrations/resolve-channel-installation', () => ({
  resolveWahaInstallationStrict: (...args: unknown[]) => mockResolveWahaInstallationStrict(...args),
  // Present only so an accidental fallback to the legacy helper is loud.
  resolveEnabledChannelInstallation: jest.fn(() => {
    throw new Error('route must not use the legacy swallow-errors resolver');
  }),
}));

jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemActionResult: (...args: unknown[]) => mockRunAtendimentoSystemActionResult(...args),
}));

jest.mock('@/lib/logger', () => ({
  logger: loggerMock,
  whatsappLogger: loggerMock,
  dbLogger: loggerMock,
}));

// The real limiter is replaced so the ~90 cases in this file cannot share a
// 100/min key (which would make them order-dependent). The blocked path is
// exercised explicitly with `mockReturnValueOnce`.
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 99, resetTime: 0 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: {
    webhook: { windowMs: 60000, maxRequests: 100 },
  },
}));

import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

import { POST } from '../route';

const HMAC_KEY = 'waha-hmac-key-for-tests-at-least-32-chars';
const SESSION = 'default';
/** Signed root timestamp (ms) inside the default freshness window of `Date.now()`. */
const NOW_MS = 1_800_000_000_000;
const PHONE = '5511999999999';
const SENDER = `${PHONE}@c.us`;
/** Default (allowed) limiter result, re-asserted before every case in this file. */
const RATE_LIMIT_ALLOWED = { allowed: true, remaining: 99, resetTime: NOW_MS + 60_000 } as const;

// The default envelope is signed with a fixed clock, so the freshness window is
// evaluated against that same clock instead of the real one.
let nowSpy: jest.SpyInstance;
beforeEach(() => {
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  // Re-assert the allowed stub for every case in this file so no test inherits
  // a consumed quota or a leftover blocked stub from another one.
  jest.mocked(checkRateLimit).mockReturnValue(RATE_LIMIT_ALLOWED);
  jest.mocked(getClientIdentifier).mockReturnValue('test-client');
  // Manifest is enabled by default; individual cases override it.
  mockCreateManifest.mockReturnValue({ isEnabled: mockIsEnabled });
  mockIsEnabled.mockResolvedValue(true);
});
afterEach(() => {
  nowSpy.mockRestore();
});

function sign(body: string, key: string = HMAC_KEY): string {
  return createHmac('sha512', key).update(body).digest('hex');
}

type RequestOptions = {
  body: string;
  /** `undefined` → valid signature over `body`; `null` → header omitted. */
  signature?: string | null;
  /** `undefined` → `sha512`; `null` → header omitted. */
  algorithm?: string | null;
  extraHeaders?: Record<string, string>;
};

/** Builds a POST whose body is the EXACT bytes under test (no re-serialization). */
function buildRequest(options: RequestOptions): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (options.signature !== null) headers['x-webhook-hmac'] = options.signature ?? sign(options.body);
  if (options.algorithm !== null) headers['x-webhook-hmac-algorithm'] = options.algorithm ?? 'sha512';
  Object.assign(headers, options.extraHeaders ?? {});
  return new NextRequest('http://localhost/api/whatsapp/waha', { method: 'POST', headers, body: options.body });
}

function messageEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: 'message',
    session: SESSION,
    timestamp: NOW_MS,
    payload: {
      id: 'false_11111111111@c.us_ABCDEF0123456789',
      timestamp: Math.floor(NOW_MS / 1000),
      from: SENDER,
      fromMe: false,
      body: 'Olá, quero um orçamento',
      hasMedia: false,
      _data: { fromMe: false, phone: '9999999999999@c.us' },
    },
    ...overrides,
  };
}

/** Header-only overrides for a request whose body is derived from the envelope. */
type HeaderOverrides = Omit<RequestOptions, 'body'>;

/** Signed request for the default valid envelope. */
function signedRequest(overrides: Record<string, unknown> = {}, options: HeaderOverrides = {}): NextRequest {
  const body = JSON.stringify(messageEnvelope(overrides));
  return buildRequest({ body, ...options });
}

function actionInput(): Record<string, unknown> {
  const call = mockRunAtendimentoSystemActionResult.mock.calls[0];
  return (call?.[1] ?? {}) as Record<string, unknown>;
}

describe('WAHA inbound webhook — HMAC authentication (fail closed)', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    mockResolveWahaInstallationStrict.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-real' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterAll(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('fails closed with 503 when the HMAC key is missing (no dev bypass)', async () => {
    delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    const res = await POST(signedRequest());

    expect(res.status).toBe(503);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the HMAC key is too short', async () => {
    process.env.WAHA_WEBHOOK_HMAC_KEY = 'short-key';
    const res = await POST(signedRequest());

    expect(res.status).toBe(503);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('fails closed with 503 in development too — there is no dev bypass', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    const res = await POST(signedRequest());

    expect(res.status).toBe(503);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a missing algorithm header with 403', async () => {
    const res = await POST(signedRequest({}, { algorithm: null }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a non-sha512 algorithm header with 403', async () => {
    const res = await POST(signedRequest({}, { algorithm: 'sha256' }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header with 403', async () => {
    const res = await POST(signedRequest({}, { signature: null }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a sha256-length signature (64 hex chars) with 403', async () => {
    const res = await POST(signedRequest({}, { signature: 'a'.repeat(64) }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a 128-char non-hex signature with 403', async () => {
    const res = await POST(signedRequest({}, { signature: 'z'.repeat(128) }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a well-formed but wrong signature with 403', async () => {
    const res = await POST(signedRequest({}, { signature: 'a'.repeat(128) }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a signature computed with a different key with 403', async () => {
    const body = JSON.stringify(messageEnvelope());
    const res = await POST(buildRequest({ body, signature: sign(body, 'another-hmac-key-of-32-characters') }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects raw-byte mutation of the signed body with 403', async () => {
    const body = JSON.stringify(messageEnvelope());
    const signature = sign(body);
    // Same JSON semantics, different bytes: a single added space in the body.
    const mutated = body.replace('{', '{ ');
    expect(mutated).not.toBe(body);

    const res = await POST(buildRequest({ body: mutated, signature }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a tampered field value while keeping the original signature', async () => {
    const body = JSON.stringify(messageEnvelope());
    const signature = sign(body);
    const tampered = JSON.stringify(messageEnvelope({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), body: 'injetado' },
    }));

    const res = await POST(buildRequest({ body: tampered, signature }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('accepts a valid sha512 signature and forwards to the inbound action', async () => {
    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
    expect(mockRunAtendimentoSystemActionResult).toHaveBeenCalledTimes(1);
    expect(actionInput()).toMatchObject({
      externalConversationId: PHONE,
      externalProvider: 'waha',
      externalMessageId: `${SESSION}:false_11111111111@c.us_ABCDEF0123456789`,
      message: 'Olá, quero um orçamento',
      channel: 'whatsapp',
      messageType: 'text',
    });
    expect(mockRunAtendimentoSystemActionResult.mock.calls[0][2]).toBe('clinic-real');
  });

  it('parses nothing before the signature is valid — malformed body with a bad signature is 403, not 400', async () => {
    const res = await POST(buildRequest({ body: 'not-json-at-all', signature: 'a'.repeat(128) }));

    expect(res.status).toBe(403);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a malformed body that IS correctly signed with 400', async () => {
    const res = await POST(buildRequest({ body: 'not-json-at-all' }));

    expect(res.status).toBe(400);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a non-object JSON envelope with 400', async () => {
    const res = await POST(buildRequest({ body: '[]' }));

    expect(res.status).toBe(400);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects an oversized ACTUAL body with 413 even without a Content-Length header', async () => {
    const oversized = 'x'.repeat(256 * 1024 + 64);
    const request = buildRequest({ body: oversized });
    // The cap must hold on the real stream, not on a declared header.
    expect(request.headers.get('content-length')).toBeNull();

    const res = await POST(request);

    expect(res.status).toBe(413);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('accepts a body just under the byte cap', async () => {
    const padding = 'x'.repeat(256 * 1024 - JSON.stringify(messageEnvelope()).length - 32);
    const body = JSON.stringify(messageEnvelope({ padding }));
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(256 * 1024);
    const res = await POST(buildRequest({ body }));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).toHaveBeenCalledTimes(1);
  });

  it('fails closed as unreadable when the runtime exposes no readable stream', async () => {
    const body = JSON.stringify(messageEnvelope());
    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-hmac': sign(body),
        'x-webhook-hmac-algorithm': 'sha512',
      }),
      body: null,
    } as unknown as NextRequest;

    const res = await POST(request);

    // Fail closed: never fall back to buffering the whole request just to size it.
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('fails closed as unreadable when getReader() throws synchronously (no framework 500)', async () => {
    // A locked/disturbed stream throws on getReader(). That must stay a
    // controlled denial: nothing may be parsed, resolved or persisted, and the
    // stream error itself must not escape into the response or the logs.
    const marker = 'MARKER-locked-stream-detail';
    const body = JSON.stringify(messageEnvelope());
    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-hmac': sign(body),
        'x-webhook-hmac-algorithm': 'sha512',
      }),
      body: {
        getReader: () => {
          throw new TypeError(`Invalid state: ReadableStream is locked (${marker})`);
        },
      },
    } as unknown as NextRequest;

    const res = await POST(request);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Invalid request body' });
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();

    const logged = JSON.stringify(loggerMock.warn.mock.calls) + JSON.stringify(loggerMock.error.mock.calls);
    expect(logged).toContain('body_unreadable');
    expect(logged).not.toContain(marker);
    expect(logged).not.toContain('ReadableStream');
    expect(logged).not.toContain(PHONE);
  });

  it('fails closed as unreadable when getReader() throws a non-TypeError value', async () => {
    const body = JSON.stringify(messageEnvelope());
    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-hmac': sign(body),
        'x-webhook-hmac-algorithm': 'sha512',
      }),
      body: {
        getReader: () => {
          throw 'raw-string-getreader-failure';
        },
      },
    } as unknown as NextRequest;

    const res = await POST(request);

    expect(res.status).toBe(400);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
    const logged = JSON.stringify(loggerMock.warn.mock.calls) + JSON.stringify(loggerMock.error.mock.calls);
    expect(logged).not.toContain('raw-string-getreader-failure');
  });

  it('times out a never-resolving body stream in bounded time, cancels it and returns 408', async () => {
    jest.useFakeTimers();
    try {
      const cancel = jest.fn();
      const stream = {
        getReader: () => ({ read: () => new Promise<never>(() => {}), cancel }),
      };
      const body = JSON.stringify(messageEnvelope());
      const request = {
        headers: new Headers({
          'content-type': 'application/json',
          'x-webhook-hmac': sign(body),
          'x-webhook-hmac-algorithm': 'sha512',
        }),
        body: stream,
      } as unknown as NextRequest;

      const pending = POST(request);
      jest.advanceTimersByTime(10_000);
      const res = await pending;

      expect(res.status).toBe(408);
      expect(await res.json()).toEqual({ error: 'Request timeout' });
      expect(cancel).toHaveBeenCalled();
      expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves no unhandled rejection when the abandoned read fails after the deadline', async () => {
    // Jest reports an unhandled rejection AS a test failure, so simply reaching
    // the assertions below is the check: if the route abandoned the in-flight
    // read without a handler, this test fails carrying the leaked error.
    jest.useFakeTimers();
    try {
      let rejectRead: (reason: unknown) => void = () => {};
      const readPromise = new Promise<{ done: boolean; value?: Uint8Array }>((_resolve, reject) => {
        rejectRead = reject;
      });
      const stream = {
        getReader: () => ({ read: () => readPromise, cancel: jest.fn() }),
      };
      const body = JSON.stringify(messageEnvelope());
      const request = {
        headers: new Headers({
          'content-type': 'application/json',
          'x-webhook-hmac': sign(body),
          'x-webhook-hmac-algorithm': 'sha512',
        }),
        body: stream,
      } as unknown as NextRequest;

      const pending = POST(request);
      jest.advanceTimersByTime(10_000);
      const res = await pending;
      expect(res.status).toBe(408);

      // The provider stalls past the deadline and only then fails the read.
      rejectRead(new Error('late stream failure'));
      jest.useRealTimers();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('WAHA inbound webhook — installation resolution (never trusts the body tenant)', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    mockResolveWahaInstallationStrict.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-real' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('resolves the installation from `session` via the strict waha-only resolver', async () => {
    await POST(signedRequest());

    // The provider is pinned inside the resolver, so the route can never be
    // pointed at another provider's installation by accident.
    expect(mockResolveWahaInstallationStrict).toHaveBeenCalledWith({ installationId: SESSION });
  });

  it('ignores an unknown/disabled installation without any side effect', async () => {
    mockResolveWahaInstallationStrict.mockResolvedValue(null);

    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('never derives the clinic from a body-supplied clinicId', async () => {
    const res = await POST(signedRequest({
      clinicId: 'clinic-attacker',
      payload: { ...(messageEnvelope().payload as Record<string, unknown>) },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    // The Action input has no clinic selector at all — the tenant is the resolved one.
    expect(actionInput()).not.toHaveProperty('clinicId');
    expect(actionInput()).not.toHaveProperty('clinic_id');
    expect(JSON.stringify(actionInput())).not.toContain('clinic-attacker');
    expect(mockRunAtendimentoSystemActionResult.mock.calls[0][2]).toBe('clinic-real');
  });

  it('ignores a missing session', async () => {
    const res = await POST(signedRequest({ session: undefined } as Record<string, unknown>));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('ignores a non-string session', async () => {
    const res = await POST(signedRequest({ session: { name: SESSION } } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });
});

describe('WAHA inbound webhook — event / sender allowlist', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    mockResolveWahaInstallationStrict.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-real' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('acknowledges an unknown event without resolving or processing', async () => {
    const res = await POST(signedRequest({ event: 'message.any' }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it.each([
    ['session.status', undefined],
    ['message.ack', undefined],
    ['message.reaction', undefined],
    ['message.revoked', undefined],
    ['group.v2.join', undefined],
    ['engine.event', undefined],
    ['Message', undefined],
  ])('acknowledges non-allowlisted event %s', async (event) => {
    const res = await POST(signedRequest({ event }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('ignores an outbound echo (fromMe: true)', async () => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), fromMe: true },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('ignores an ambiguous fromMe (missing)', async () => {
    const payload = { ...(messageEnvelope().payload as Record<string, unknown>) } as Record<string, unknown>;
    delete payload.fromMe;
    const res = await POST(signedRequest({ payload } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('ignores a truthy-but-not-true fromMe value', async () => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), fromMe: 'false' },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it.each([
    ['group', '120363000000000000@g.us'],
    ['broadcast', 'status@broadcast'],
    ['newsletter', '1234567890@newsletter'],
    ['lid', '9999999999999@lid'],
    ['legacy', `${PHONE}@s.whatsapp.net`],
    ['user', `${PHONE}@c.us.evil.example`],
    ['no suffix', PHONE],
    ['empty', ''],
  ])('rejects an unsupported sender (%s)', async (_label, from) => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), from },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects an over-long phone on an otherwise valid @c.us sender', async () => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), from: `${'9'.repeat(16)}@c.us` },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('never extracts a phone from `_data`', async () => {
    const res = await POST(signedRequest({
      payload: {
        ...(messageEnvelope().payload as Record<string, unknown>),
        from: 'broadcast@g.us',
        _data: { from: '9999999999999@c.us', remoteJid: '8888888888888@c.us' },
      },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
    const serialized = JSON.stringify(mockRunAtendimentoSystemActionResult.mock.calls);
    expect(serialized).not.toContain('9999999999999');
    expect(serialized).not.toContain('8888888888888');
  });

  it('ignores a missing provider message id', async () => {
    const payload = { ...(messageEnvelope().payload as Record<string, unknown>) } as Record<string, unknown>;
    delete payload.id;
    const res = await POST(signedRequest({ payload } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('ignores an over-long provider message id (dedup id would exceed 255 chars)', async () => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), id: 'z'.repeat(300) },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });
});

describe('WAHA inbound webhook — dedup identity, normalization and metadata', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    mockResolveWahaInstallationStrict.mockImplementation(async ({ installationId }: { installationId: string }) => ({
      installationId,
      clinicId: 'clinic-real',
    }));
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('scopes the dedup id to the session: `${session}:${payload.id}`', async () => {
    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    expect(actionInput().externalMessageId).toBe(`${SESSION}:false_11111111111@c.us_ABCDEF0123456789`);
  });

  it('produces a different dedup id for the same provider message in another session', async () => {
    await POST(signedRequest({ session: 'default' } as Record<string, unknown>));
    await POST(signedRequest({ session: 'clinica-b' } as Record<string, unknown>));

    const ids = mockRunAtendimentoSystemActionResult.mock.calls.map(
      (call) => (call[1] as Record<string, unknown>).externalMessageId,
    );
    expect(ids).toEqual([
      'default:false_11111111111@c.us_ABCDEF0123456789',
      'clinica-b:false_11111111111@c.us_ABCDEF0123456789',
    ]);
    // Server-side provider identity — never a header/request id.
    expect(actionInput().externalProvider).toBe('waha');
  });

  it('persists only allowlisted metadata (session + WAHA message id)', async () => {
    await POST(signedRequest());

    expect(actionInput().metadata).toEqual({
      session: SESSION,
      waha_message_id: 'false_11111111111@c.us_ABCDEF0123456789',
    });
  });

  it('normalizes an image message to its caption and never stores the media url', async () => {
    const res = await POST(signedRequest({
      payload: {
        ...(messageEnvelope().payload as Record<string, unknown>),
        hasMedia: true,
        body: 'foto do paciente',
        media: { mimetype: 'image/jpeg', filename: 'foto.jpg', url: 'https://waha.example/media/secret-token.png' },
        _data: { mediaKey: 'super-secret' },
      },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(actionInput().messageType).toBe('image');
    expect(actionInput().message).toBe('foto do paciente');

    const serialized = JSON.stringify(actionInput());
    expect(serialized).not.toContain('waha.example');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('_data');
  });

  it('normalizes an image without caption to the [Image] placeholder', async () => {
    await POST(signedRequest({
      payload: {
        id: 'img-1', timestamp: Math.floor(NOW_MS / 1000), from: SENDER, fromMe: false, body: '', hasMedia: true,
        media: { mimetype: 'image/png', filename: 'x.png', url: 'https://waha.example/x.png' },
      },
    } as Record<string, unknown>));

    expect(actionInput().messageType).toBe('image');
    expect(actionInput().message).toBe('[Image]');
    expect(JSON.stringify(actionInput())).not.toContain('waha.example');
  });

  it('normalizes an audio message to the [Audio] placeholder without the media url', async () => {
    await POST(signedRequest({
      payload: {
        id: 'aud-1', timestamp: Math.floor(NOW_MS / 1000), from: SENDER, fromMe: false, hasMedia: true,
        media: { mimetype: 'audio/ogg; codecs=opus', filename: 'voice.ogg', url: 'https://waha.example/a.ogg' },
      },
    } as Record<string, unknown>));

    expect(actionInput().messageType).toBe('audio');
    expect(actionInput().message).toBe('[Audio]');
    expect(JSON.stringify(actionInput())).not.toContain('waha.example');
  });

  it('normalizes a document message to its filename', async () => {
    await POST(signedRequest({
      payload: {
        id: 'doc-1', timestamp: Math.floor(NOW_MS / 1000), from: SENDER, fromMe: false, hasMedia: true,
        media: { mimetype: 'application/pdf', filename: 'exame.pdf', url: 'https://waha.example/d.pdf' },
      },
    } as Record<string, unknown>));

    expect(actionInput().messageType).toBe('document');
    expect(actionInput().message).toBe('exame.pdf');
    expect(JSON.stringify(actionInput())).not.toContain('waha.example');
  });

  it('normalizes a document without filename to the [Document] placeholder', async () => {
    await POST(signedRequest({
      payload: {
        id: 'doc-2', timestamp: Math.floor(NOW_MS / 1000), from: SENDER, fromMe: false, hasMedia: true,
        media: { mimetype: 'application/pdf' },
      },
    } as Record<string, unknown>));

    expect(actionInput().messageType).toBe('document');
    expect(actionInput().message).toBe('[Document]');
  });

  it('ignores media with an unsupported mimetype (fail closed, no side effect)', async () => {
    const res = await POST(signedRequest({
      payload: {
        id: 'exe-1', timestamp: Math.floor(NOW_MS / 1000), from: SENDER, fromMe: false, hasMedia: true,
        media: { mimetype: 'application/x-msdownload', filename: 'evil.exe', url: 'https://waha.example/e.exe' },
      },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('ignores media without a usable mimetype', async () => {
    const res = await POST(signedRequest({
      payload: {
        id: 'nomime-1', timestamp: Math.floor(NOW_MS / 1000), from: SENDER, fromMe: false, hasMedia: true,
        media: { url: 'https://waha.example/x.bin' },
      },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('ignores a text message with an empty body', async () => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), body: '   ' },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('bounds the content to the Action 32k limit', async () => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), body: 'a'.repeat(40_000) },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    expect(String(actionInput().message)).toHaveLength(32_000);
  });

  it('marks truncation with an ellipsis inside the limit instead of silently dropping text', async () => {
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), body: 'a'.repeat(40_000) },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    const message = String(actionInput().message);
    expect(message.length).toBeLessThanOrEqual(32_000);
    // Truncation is visible to the consumer, not a silent loss of content.
    expect(message.endsWith('…')).toBe(true);
    expect(message.slice(0, -1)).toBe('a'.repeat(message.length - 1));
  });

  it('never splits a surrogate pair when truncating (emoji boundary)', async () => {
    const emoji = '😀'.repeat(20_000); // 40k UTF-16 units of astral characters
    const res = await POST(signedRequest({
      payload: { ...(messageEnvelope().payload as Record<string, unknown>), body: emoji },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    const message = String(actionInput().message);
    expect(message.length).toBeLessThanOrEqual(32_000);
    expect(message.endsWith('…')).toBe(true);
    // A lone surrogate would round-trip through UTF-8 as U+FFFD.
    const kept = message.slice(0, -1);
    expect(kept).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(Buffer.from(kept, 'utf8').toString('utf8')).toBe(kept);
    expect(Buffer.byteLength(kept, 'utf8')).toBe(kept.length * 2);
  });

  it('logs a fixed sanitized reason when truncating, without content', async () => {
    const secretText = ['senha-', '1234567890'].join('');
    const res = await POST(signedRequest({
      payload: {
        ...(messageEnvelope().payload as Record<string, unknown>),
        body: `${secretText}${'b'.repeat(40_000)}`,
      },
    } as Record<string, unknown>));

    expect(res.status).toBe(200);
    const logged = JSON.stringify(loggerMock.warn.mock.calls);
    expect(logged).toContain('content_truncated');
    expect(logged).not.toContain(secretText);
    expect(logged).not.toContain(PHONE);
    expect(logged).not.toContain(SESSION);
  });

  it('does not log or mark truncation for content within the limit', async () => {
    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    expect(String(actionInput().message)).toBe('Olá, quero um orçamento');
    expect(JSON.stringify(loggerMock.warn.mock.calls)).not.toContain('content_truncated');
  });
});

describe('WAHA inbound webhook — acknowledgments and log hygiene', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    mockResolveWahaInstallationStrict.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-real' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({
      ok: true,
      data: { deduped: false, conversationId: 'conv-secret', messageId: 'msg-secret' },
    });
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('returns a minimal ack without internal conversation/message identifiers', async () => {
    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual({ status: 'ok' });
    expect(raw).not.toContain('conv-secret');
    expect(raw).not.toContain('msg-secret');
    expect(raw).not.toContain('clinic-real');
    expect(raw).not.toContain(PHONE);
  });

  it('returns a retryable 503 with a generic body when the Action rejects persistence', async () => {
    mockRunAtendimentoSystemActionResult.mockResolvedValue({
      ok: false,
      error: { code: 'internal', message: 'Falha ao persistir mensagem inbound.' },
    });

    const res = await POST(signedRequest());

    expect(res.status).toBe(503);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual({ error: 'Unable to process message' });
    expect(raw).not.toContain('Falha ao persistir');
    expect(raw).not.toContain('conv-secret');
    expect(raw).not.toContain(PHONE);
  });

  it('returns a retryable 503 when the Action throws', async () => {
    mockRunAtendimentoSystemActionResult.mockRejectedValue(
      new Error('connection terminated for 5511999999999 / default'),
    );

    const res = await POST(signedRequest());

    expect(res.status).toBe(503);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual({ error: 'Unable to process message' });
    expect(raw).not.toContain('connection terminated');
    expect(raw).not.toContain(PHONE);
  });

  it('does not leak a raw persistence failure into logs on the 503 path', async () => {
    const marker = 'MARKER-raw-db-detail-5511999999999';
    mockRunAtendimentoSystemActionResult.mockResolvedValue({
      ok: false,
      error: { code: 'internal', message: marker },
    });

    await POST(signedRequest());

    const logged = JSON.stringify(loggerMock.warn.mock.calls) + JSON.stringify(loggerMock.error.mock.calls);
    expect(logged).not.toContain(marker);
    expect(logged).not.toContain(PHONE);
  });

  it('returns a retryable 503 when the installation resolver is down (outage != unknown)', async () => {
    mockResolveWahaInstallationStrict.mockRejectedValue(
      new Error('resolveWahaInstallationStrict lookup unavailable'),
    );

    const res = await POST(signedRequest());

    expect(res.status).toBe(503);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual({ error: 'Unable to process message' });
    expect(raw).not.toContain('resolveWahaInstallationStrict');
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('never leaks secret, signature, body, phone, session, _data or media url into logs', async () => {
    const body = JSON.stringify(messageEnvelope({
      payload: {
        id: 'log-1', timestamp: Math.floor(NOW_MS / 1000), from: SENDER, fromMe: false,
        body: 'senha 1234567890', hasMedia: true,
        media: { mimetype: 'image/jpeg', filename: 'f.jpg', url: 'https://waha.example/secret-media.png' },
        _data: { key: 'engine-secret' },
      },
    } as Record<string, unknown>));
    const signature = sign(body);

    await POST(buildRequest({ body, signature }));
    await POST(buildRequest({ body, signature: 'a'.repeat(128) }));
    await POST(signedRequest({ event: 'message.ack' } as Record<string, unknown>));
    delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    await POST(buildRequest({ body, signature }));

    const logged = JSON.stringify(loggerMock.warn.mock.calls)
      + JSON.stringify(loggerMock.error.mock.calls)
      + JSON.stringify(loggerMock.info.mock.calls);
    expect(loggerMock.warn).toHaveBeenCalled();
    expect(logged).not.toContain(HMAC_KEY);
    expect(logged).not.toContain(signature);
    expect(logged).not.toContain('a'.repeat(128));
    expect(logged).not.toContain(PHONE);
    expect(logged).not.toContain('senha 1234567890');
    expect(logged).not.toContain(SESSION);
    expect(logged).not.toContain('engine-secret');
    expect(logged).not.toContain('waha.example');
    expect(logged).not.toContain('log-1');
    expect(logged).not.toContain('clinic-real');
  });
});

describe('WAHA inbound webhook — rate limit precedes any expensive work', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;
  /** Client identifier + config the route is expected to use. */
  const CLIENT = '203.0.113.7';

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    // Re-assert after the clear so this block is self-sufficient: no test can
    // inherit another block's consumed quota or a leftover blocked stub.
    jest.mocked(checkRateLimit).mockReturnValue(RATE_LIMIT_ALLOWED);
    jest.mocked(getClientIdentifier).mockReturnValue(CLIENT);
    mockResolveWahaInstallationStrict.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-real' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('uses the client identifier with the webhook preset under the waha-webhook keyPrefix', async () => {
    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    expect(getClientIdentifier).toHaveBeenCalledWith(expect.anything());
    expect(checkRateLimit).toHaveBeenCalledWith(CLIENT, {
      windowMs: 60_000,
      maxRequests: 100,
      keyPrefix: 'waha-webhook',
    });
  });

  it('calls the limiter BEFORE the body stream is read', async () => {
    const order: string[] = [];
    jest.mocked(checkRateLimit).mockImplementation(() => {
      order.push('rate-limit');
      return RATE_LIMIT_ALLOWED;
    });
    const body = JSON.stringify(messageEnvelope());
    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-hmac': sign(body),
        'x-webhook-hmac-algorithm': 'sha512',
      }),
      body: {
        getReader: () => {
          order.push('body');
          return {
            read: async () => ({ done: true, value: undefined }),
            cancel: jest.fn(),
          };
        },
      },
    } as unknown as NextRequest;

    await POST(request);

    expect(order[0]).toBe('rate-limit');
    expect(order).toEqual(['rate-limit', 'body']);
  });

  it('returns 429 with Retry-After and a requestId when blocked, without reading the body', async () => {
    jest.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: NOW_MS + 30_000,
      retryAfter: 30,
    });
    let bodyTouched = false;
    const body = JSON.stringify(messageEnvelope());
    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-hmac': sign(body),
        'x-webhook-hmac-algorithm': 'sha512',
      }),
      body: {
        getReader: () => {
          bodyTouched = true;
          return { read: async () => ({ done: true, value: undefined }), cancel: jest.fn() };
        },
      },
    } as unknown as NextRequest;

    const res = await POST(request);

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    const payload = await res.json() as { error: { code: string; message: string; requestId: string } };
    expect(payload.error.code).toBe('TOO_MANY_REQUESTS');
    expect(payload.error.requestId).toEqual(expect.any(String));
    expect(payload.error.requestId.length).toBeGreaterThan(0);
    // Retry-After is header-only per ADR-BASE-10.
    expect(JSON.stringify(payload)).not.toContain('retryAfter');

    // Nothing downstream of the limiter ran: no HMAC, no tenant, no persistence.
    expect(bodyTouched).toBe(false);
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('blocks even a correctly signed, otherwise valid webhook (no HMAC bypass via the limiter)', async () => {
    jest.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: NOW_MS + 15_000,
      retryAfter: 15,
    });

    const res = await POST(signedRequest());

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('15');
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('never verifies the signature for a blocked request (HMAC is not computed)', async () => {
    jest.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: NOW_MS + 60_000,
      retryAfter: 60,
    });
    // A deliberately invalid signature: if HMAC were reached, this would 403.
    const res = await POST(signedRequest({}, { signature: 'a'.repeat(128) }));

    // 429 (not 403) proves the limiter short-circuited ahead of verification.
    expect(res.status).toBe(429);
  });

  it('logs only a fixed rate_limited reason on the blocked path', async () => {
    jest.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: NOW_MS + 60_000,
      retryAfter: 60,
    });

    await POST(signedRequest());

    const logged = JSON.stringify(loggerMock.warn.mock.calls) + JSON.stringify(loggerMock.error.mock.calls);
    expect(logged).toContain('rate_limited');
    expect(logged).not.toContain(HMAC_KEY);
    expect(logged).not.toContain(PHONE);
    expect(logged).not.toContain(SESSION);
    expect(logged).not.toContain('Retry-After');
  });

  it('still processes normally when the limiter allows the request', async () => {
    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ok' });
    expect(mockRunAtendimentoSystemActionResult).toHaveBeenCalledTimes(1);
  });
});

/**
 * Rate-limit IDENTITY.
 *
 * In production the limiter key must come from `CF-Connecting-IP` — the client
 * IP Cloudflare itself injects on the Workers/OpenNext path — and from NOTHING
 * else. `X-Forwarded-For`/`X-Real-IP` are client-settable on this public route,
 * so trusting them would let any caller mint a fresh quota with one header,
 * which defeats the limiter that is the first thing standing in front of the
 * body read and the HMAC.
 */
describe('WAHA inbound webhook — rate-limit identity uses the Cloudflare client IP', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;
  const originalNodeEnv = process.env.NODE_ENV;
  /** The single fail-safe bucket used when no usable CF client IP is present. */
  const SENTINEL = 'unknown-cf-client';
  const CF_IP = '198.51.100.23';
  const FORGED_XFF = '203.0.113.250';
  const FORGED_REAL_IP = '203.0.113.251';
  /** The `waha-webhook` preset + prefix the route must keep using. */
  const EXPECTED_CONFIG = { windowMs: 60_000, maxRequests: 100, keyPrefix: 'waha-webhook' };

  function setNodeEnv(value: string): void {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  }

  /** Every key the route handed to the limiter, in call order. */
  function limiterKeys(): string[] {
    return jest.mocked(checkRateLimit).mock.calls.map((call) => call[0]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    setNodeEnv('production');
    jest.mocked(checkRateLimit).mockReturnValue(RATE_LIMIT_ALLOWED);
    jest.mocked(getClientIdentifier).mockReturnValue('test-client');
    mockCreateManifest.mockReturnValue({ isEnabled: mockIsEnabled });
    mockIsEnabled.mockResolvedValue(true);
    mockResolveWahaInstallationStrict.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-real' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterAll(() => {
    // Restored rather than deleted: `NODE_ENV` is read-only on the typed
    // `process.env` shape, and an absent value is meaningless under Jest.
    setNodeEnv(originalNodeEnv ?? 'test');
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('keys by CF-Connecting-IP when x-forwarded-for is forged', async () => {
    const res = await POST(signedRequest({}, {
      extraHeaders: { 'cf-connecting-ip': CF_IP, 'x-forwarded-for': FORGED_XFF },
    }));

    expect(res.status).toBe(200);
    expect(checkRateLimit).toHaveBeenCalledWith(CF_IP, EXPECTED_CONFIG);
    expect(limiterKeys()).not.toContain(FORGED_XFF);
  });

  it('keys by CF-Connecting-IP when x-real-ip is forged', async () => {
    await POST(signedRequest({}, {
      extraHeaders: { 'cf-connecting-ip': CF_IP, 'x-real-ip': FORGED_REAL_IP },
    }));

    expect(checkRateLimit).toHaveBeenCalledWith(CF_IP, EXPECTED_CONFIG);
    expect(limiterKeys()).not.toContain(FORGED_REAL_IP);
  });

  it('never consults the spoofable helper (or XFF/X-Real-IP) in production', async () => {
    await POST(signedRequest({}, {
      extraHeaders: { 'cf-connecting-ip': CF_IP, 'x-forwarded-for': FORGED_XFF, 'x-real-ip': FORGED_REAL_IP },
    }));

    // The global `getClientIdentifier` (XFF → X-Real-IP → "unknown") must not be
    // reached at all on this path, in any form.
    expect(getClientIdentifier).not.toHaveBeenCalled();
    expect(limiterKeys()).toEqual([CF_IP]);
  });

  it('trims the CF client IP before keying', async () => {
    await POST(signedRequest({}, { extraHeaders: { 'cf-connecting-ip': `  ${CF_IP}  ` } }));

    expect(checkRateLimit).toHaveBeenCalledWith(CF_IP, EXPECTED_CONFIG);
  });

  it('falls back to the fixed sentinel when CF-Connecting-IP is missing — never to XFF', async () => {
    await POST(signedRequest({}, { extraHeaders: { 'x-forwarded-for': FORGED_XFF } }));

    expect(checkRateLimit).toHaveBeenCalledWith(SENTINEL, EXPECTED_CONFIG);
    expect(limiterKeys()).not.toContain(FORGED_XFF);
    // `unknown` is `getClientIdentifier`'s own fallback: a regression that quietly
    // fell back to the spoofable helper would produce it and fail this assertion.
    expect(limiterKeys()).not.toContain('unknown');
  });

  it.each([
    ['empty', ''],
    ['whitespace only', '   '],
    ['over the length bound', 'a'.repeat(65)],
    ['comma-separated list', `${CF_IP}, ${FORGED_XFF}`],
    ['inner whitespace', '198.51.100. 23'],
  ])('uses the fixed sentinel for an unusable CF header (%s)', async (_label, value) => {
    await POST(signedRequest({}, {
      extraHeaders: { 'cf-connecting-ip': value, 'x-forwarded-for': FORGED_XFF },
    }));

    expect(checkRateLimit).toHaveBeenCalledWith(SENTINEL, EXPECTED_CONFIG);
    expect(limiterKeys()).not.toContain(value);
  });

  it('accepts a CF client IP exactly at the length bound', async () => {
    // 64 chars is the documented bound; the guard must be "> bound", not ">=".
    const atBound = 'a'.repeat(64);
    await POST(signedRequest({}, { extraHeaders: { 'cf-connecting-ip': atBound } }));

    expect(checkRateLimit).toHaveBeenCalledWith(atBound, EXPECTED_CONFIG);
  });

  it('collapses every unidentified caller into ONE shared quota (no forged-key minting)', async () => {
    await POST(signedRequest({}, { extraHeaders: { 'x-forwarded-for': FORGED_XFF } }));
    await POST(signedRequest({}, { extraHeaders: { 'x-forwarded-for': FORGED_REAL_IP } }));
    await POST(signedRequest({}, { extraHeaders: { 'cf-connecting-ip': '   ' } }));

    const keys = limiterKeys();
    expect(keys).toHaveLength(3);
    expect(keys.every((key) => key === SENTINEL)).toBe(true);
  });

  it('still runs the limiter FIRST and pre-HMAC/body with the production key', async () => {
    const order: string[] = [];
    jest.mocked(checkRateLimit).mockImplementation((key) => {
      order.push(`rate-limit:${key}`);
      return RATE_LIMIT_ALLOWED;
    });
    const body = JSON.stringify(messageEnvelope());
    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-hmac': sign(body),
        'x-webhook-hmac-algorithm': 'sha512',
        'cf-connecting-ip': CF_IP,
      }),
      body: {
        getReader: () => {
          order.push('body');
          return { read: async () => ({ done: true, value: undefined }), cancel: jest.fn() };
        },
      },
    } as unknown as NextRequest;

    await POST(request);

    expect(order).toEqual([`rate-limit:${CF_IP}`, 'body']);
  });

  it('blocks with 429 before body/HMAC even when CF-Connecting-IP is absent', async () => {
    jest.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: NOW_MS + 30_000,
      retryAfter: 30,
    });
    let bodyTouched = false;
    const body = JSON.stringify(messageEnvelope());
    const request = {
      headers: new Headers({
        'content-type': 'application/json',
        'x-webhook-hmac': 'a'.repeat(128),
        'x-webhook-hmac-algorithm': 'sha512',
      }),
      body: {
        getReader: () => {
          bodyTouched = true;
          return { read: async () => ({ done: true, value: undefined }), cancel: jest.fn() };
        },
      },
    } as unknown as NextRequest;

    const res = await POST(request);

    // 429 (not 403) proves the sentinel path still short-circuits pre-HMAC.
    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith(SENTINEL, EXPECTED_CONFIG);
    expect(bodyTouched).toBe(false);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it.each(['development', 'test'])('keeps the existing helper fallback in %s', async (nodeEnv) => {
    setNodeEnv(nodeEnv);
    jest.mocked(getClientIdentifier).mockReturnValue('dev-client');

    const res = await POST(signedRequest({}, { extraHeaders: { 'x-forwarded-for': FORGED_XFF } }));

    expect(res.status).toBe(200);
    expect(getClientIdentifier).toHaveBeenCalledWith(expect.anything());
    expect(checkRateLimit).toHaveBeenCalledWith('dev-client', EXPECTED_CONFIG);
  });

  it('does not switch identity to CF-Connecting-IP in development (helper stays authoritative)', async () => {
    setNodeEnv('development');
    jest.mocked(getClientIdentifier).mockReturnValue('dev-client');

    await POST(signedRequest({}, { extraHeaders: { 'cf-connecting-ip': CF_IP } }));

    expect(checkRateLimit).toHaveBeenCalledWith('dev-client', EXPECTED_CONFIG);
    expect(limiterKeys()).not.toContain(CF_IP);
  });
});

describe('WAHA inbound webhook — module gate runs only after authentication', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    jest.mocked(checkRateLimit).mockReturnValue(RATE_LIMIT_ALLOWED);
    mockCreateManifest.mockReturnValue({ isEnabled: mockIsEnabled });
    mockIsEnabled.mockResolvedValue(true);
    mockResolveWahaInstallationStrict.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-real' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it.each([
    ['a missing HMAC key', null],
    ['a missing algorithm header', 'algorithm'],
    ['a wrong algorithm', 'sha256'],
    ['a malformed signature', 'short'],
    ['a wrong signature', 'mismatch'],
  ])('never queries the module manifest for unauthenticated traffic (%s)', async (_label, flavour) => {
    let request = signedRequest();
    if (flavour === null) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    if (flavour === 'algorithm') request = signedRequest({}, { algorithm: null });
    if (flavour === 'sha256') request = signedRequest({}, { algorithm: 'sha256' });
    if (flavour === 'short') request = signedRequest({}, { signature: 'a'.repeat(64) });
    if (flavour === 'mismatch') request = signedRequest({}, { signature: 'a'.repeat(128) });

    await POST(request);

    expect(mockCreateManifest).not.toHaveBeenCalled();
    expect(mockIsEnabled).not.toHaveBeenCalled();
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('never queries the manifest when the limiter blocks the request', async () => {
    jest.mocked(checkRateLimit).mockReturnValueOnce({
      allowed: false, remaining: 0, resetTime: NOW_MS + 60_000, retryAfter: 60,
    });

    await POST(signedRequest());

    expect(mockCreateManifest).not.toHaveBeenCalled();
    expect(mockIsEnabled).not.toHaveBeenCalled();
  });

  it('queries the manifest BEFORE installation resolution and the Action', async () => {
    const order: string[] = [];
    mockCreateManifest.mockImplementation(() => {
      order.push('manifest');
      return {
        isEnabled: async () => {
          order.push('module-enabled');
          return true;
        },
      };
    });
    mockResolveWahaInstallationStrict.mockImplementation(async () => {
      order.push('install');
      return { installationId: SESSION, clinicId: 'clinic-real' };
    });
    mockRunAtendimentoSystemActionResult.mockImplementation(async () => {
      order.push('action');
      return { ok: true, data: { deduped: false } };
    });

    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    expect(order).toEqual(['manifest', 'module-enabled', 'install', 'action']);
  });

  it('keeps the module gate before installation/action work', async () => {
    const res = await POST(signedRequest());

    expect(res.status).toBe(200);
    expect(mockCreateManifest).toHaveBeenCalledTimes(1);
    expect(mockIsEnabled).toHaveBeenCalledWith('atendimento');
  });

  it('returns 404 and skips installation/Action when the module is disabled', async () => {
    mockIsEnabled.mockResolvedValue(false);

    const res = await POST(signedRequest());

    expect(res.status).toBe(404);
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('returns a generic retryable 503 when the manifest lookup fails (no raw error)', async () => {
    const marker = 'MARKER-manifest-db-connect-postgres://synkroo:hunter2@db:5432/synkroo';
    mockIsEnabled.mockRejectedValueOnce(new Error(`connection terminated: ${marker}`));

    const res = await POST(signedRequest());

    expect(res.status).toBe(503);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual({ error: 'Unable to process message' });
    expect(raw).not.toContain('hunter2');
    expect(raw).not.toContain('postgres://');
    expect(raw).not.toContain('MARKER');

    // The failure happened before the inner handler ran: no tenant, no Action.
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();

    const logged = JSON.stringify(loggerMock.warn.mock.calls) + JSON.stringify(loggerMock.error.mock.calls);
    expect(logged).toContain('module_gate_failed');
    expect(logged).not.toContain('hunter2');
    expect(logged).not.toContain(marker);
    expect(logged).not.toContain('connection terminated');
  });

  it.each([
    ['an unknown event', { event: 'message.ack' }],
    ['a session.status event', { event: 'session.status' }],
  ])('acknowledges a signed %s without any manifest lookup', async (_label, override) => {
    const res = await POST(signedRequest(override as Record<string, unknown>));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockCreateManifest).not.toHaveBeenCalled();
    expect(mockIsEnabled).not.toHaveBeenCalled();
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing session', { session: undefined }],
    ['a non-string session', { session: { name: SESSION } }],
    ['an empty session', { session: '' }],
    ['an over-long session', { session: 'a'.repeat(200) }],
    ['a session with illegal characters', { session: 'has spaces/and@chars' }],
  ])('acknowledges a signed message with %s without any manifest lookup', async (_label, override) => {
    const res = await POST(signedRequest(override as Record<string, unknown>));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockCreateManifest).not.toHaveBeenCalled();
    expect(mockResolveWahaInstallationStrict).not.toHaveBeenCalled();
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });
});