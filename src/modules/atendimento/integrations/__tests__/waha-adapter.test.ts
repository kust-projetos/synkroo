/**
 * Unit test: WahaAdapter (vNext P3.2 — outbound text slice).
 *
 * The slice is deliberately narrow and DORMANT: outbound text only, wired to
 * `POST /api/sendText` (WAHA docs), no inbound/webhook, no media, no session
 * lifecycle, and no provider-selection change in `channel-service`.
 *
 * Security invariants covered here:
 * - server-only config, fails closed, never any network activity without config;
 * - base URL validated (HTTPS, or http loopback outside production only; no
 *   userinfo/query/fragment/non-root path) and `redirect: 'error'`;
 * - exactly ONE attempt (no retry) with an end-to-end deadline that also covers
 *   reading the response body;
 * - only the root `WAMessage.id` is mapped (`_data` is never read);
 * - typed, sanitized `WahaProviderError` — no recipient, text, api key, provider
 *   body, raw exception or URL in errors/logs.
 */

jest.mock('@/lib/logger', () => ({
  logger: { child: () => ({}) },
  apiLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../services/evolution-service', () => ({
  getEvolutionService: jest.fn(),
}));

import { whatsappLogger } from '@/lib/logger';
import { getEvolutionService } from '../../services/evolution-service';
import { sendWhatsAppMessage } from '../../services/channel-service';
import { WahaAdapter, wahaWhatsAppProviderAdapter } from '../waha-adapter';

const mockLogger = whatsappLogger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};
const mockGetEvolutionService = getEvolutionService as jest.MockedFunction<typeof getEvolutionService>;

const API_URL = 'https://waha.internal.example.com';
const API_KEY = 'waha-super-secret-key';
const SESSION = 'synkroo-waha';
const PHONE = '5511999999999';
const TEXT = 'Olá, tudo bem?';

const encoder = new TextEncoder();

/** Resposta JSON mínima (sem `body` stream → o adapter usa `text()`). */
function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: null,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

/** Resposta com stream controlado (para deadline de body e limite de bytes). */
function streamResponse(chunks: Uint8Array[], status = 200): Response {
  let index = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: {
      getReader: () => ({
        read: async () => (index < chunks.length
          ? { done: false, value: chunks[index++] }
          : { done: true, value: undefined }),
        cancel: async () => undefined,
      }),
    },
    text: async () => JSON.stringify({ id: 'true_1@c.us_AAA' }),
  } as unknown as Response;
}

/** Body que nunca resolve — simula WAHA que trava no meio da resposta. */
function stalledStreamResponse(): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: {
      getReader: () => ({
        read: () => new Promise<never>(() => undefined),
        cancel: async () => undefined,
      }),
    },
    text: () => new Promise<never>(() => undefined),
  } as unknown as Response;
}

/**
 * Resposta de erro HTTP cujo cancelamento de body TRAVA para sempre — simula um
 * provider/lib que nunca libera o stream (o cancel não pode estourar o deadline).
 */
function hangingCancelResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    body: { cancel: () => new Promise<never>(() => undefined) },
    text: () => new Promise<never>(() => undefined),
  } as unknown as Response;
}

function setValidConfig(env: NodeJS.ProcessEnv = process.env): void {
  env.WAHA_API_URL = API_URL;
  env.WAHA_API_KEY = API_KEY;
  env.WAHA_SESSION = SESSION;
}

/** `process.env.NODE_ENV` é read-only nos tipos do Next — mutamos via cast. */
function setNodeEnv(value: string): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function clearWahaConfig(env: NodeJS.ProcessEnv = process.env): void {
  delete env.WAHA_API_URL;
  delete env.WAHA_API_KEY;
  delete env.WAHA_SESSION;
}

/** Erro reportado ao chamador (sem `cause`, sem corpo do provider). */
async function captureError(promise: Promise<unknown>): Promise<Error & { code?: string; status?: number }> {
  try {
    await promise;
  } catch (error) {
    return error as Error & { code?: string; status?: number };
  }
  throw new Error('expected the call to reject');
}

describe('WahaAdapter (P3.2 — outbound text, dormant)', () => {
  const originalEnv = process.env;
  let fetchImpl: jest.Mock;

  function adapter(overrides: { timeoutMs?: number; maxResponseBytes?: number } = {}): WahaAdapter {
    return new WahaAdapter({ fetchImpl: fetchImpl as unknown as typeof fetch, ...overrides });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    fetchImpl = jest.fn();
    process.env = { ...originalEnv };
    setNodeEnv('test');
    clearWahaConfig();
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('registration', () => {
    it('is registered under the "waha" provider id', () => {
      expect(wahaWhatsAppProviderAdapter.id).toBe('waha');
    });
  });

  describe('config fails closed (no network activity)', () => {
    it('is unavailable and never fetches without any WAHA config', async () => {
      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(false);

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('not_configured');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ['WAHA_API_URL only', { WAHA_API_URL: API_URL }],
      ['WAHA_API_URL + WAHA_API_KEY', { WAHA_API_URL: API_URL, WAHA_API_KEY: API_KEY }],
      ['WAHA_API_KEY + WAHA_SESSION', { WAHA_API_KEY: API_KEY, WAHA_SESSION: SESSION }],
      ['empty values', { WAHA_API_URL: '   ', WAHA_API_KEY: '', WAHA_SESSION: SESSION }],
    ])('is unavailable and never fetches with partial config (%s)', async (_label, partial) => {
      Object.assign(process.env, partial);

      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(false);

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('not_configured');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ['http non-loopback', 'http://waha.example.com'],
      ['http userinfo', 'https://user:pass@waha.example.com'],
      ['query string', 'https://waha.example.com/?token=1'],
      ['fragment', 'https://waha.example.com/#frag'],
      ['non-root path', 'https://waha.example.com/waha'],
      ['not a url', 'waha.example.com'],
      ['unsupported scheme', 'ftp://waha.example.com'],
    ])('is unavailable for an invalid base URL (%s)', async (_label, url) => {
      setValidConfig();
      process.env.WAHA_API_URL = url;

      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(false);

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('invalid_config');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it.each([
      ['127.0.0.1', 'http://127.0.0.1:3000'],
      ['localhost', 'http://localhost:3000'],
      ['::1', 'http://[::1]:3000'],
    ])('accepts http loopback %s outside production', async (_label, url) => {
      setValidConfig();
      process.env.WAHA_API_URL = url;
      setNodeEnv('development');

      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(true);
    });

    it('rejects http loopback in production (HTTPS only)', () => {
      setValidConfig();
      process.env.WAHA_API_URL = 'http://127.0.0.1:3000';
      setNodeEnv('production');

      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(false);
    });

    it('resolves config lazily — no startup side effect and no cached state', () => {
      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(false);
      expect(fetchImpl).not.toHaveBeenCalled();

      setValidConfig();

      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(true);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe('successful send', () => {
    it('POSTs exactly /api/sendText with X-Api-Key, JSON body and the mapped chat id', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse({ id: 'true_5511999999999@c.us_3EB0' }));

      const result = await adapter().sendTextMessage(PHONE, TEXT);

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://waha.internal.example.com/api/sendText');
      expect(init.method).toBe('POST');
      expect(init.redirect).toBe('error');
      expect(init.signal).toBeDefined();
      expect(init.headers).toMatchObject({
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(String(init.body))).toEqual({
        session: SESSION,
        chatId: '5511999999999@c.us',
        text: TEXT,
      });
      expect(result).toEqual({ success: true, messageId: 'true_5511999999999@c.us_3EB0' });
    });

    it('maps only the root WAMessage.id and never exposes _data', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(
        jsonResponse({
          id: 'true_5511999999999@c.us_3EB0',
          timestamp: 1,
          _data: { id: 'other-id', secret: 'nope' },
        }),
      );

      const result = await adapter().sendTextMessage(PHONE, TEXT);

      expect(result).toEqual({ success: true, messageId: 'true_5511999999999@c.us_3EB0' });
      expect(JSON.stringify(result)).not.toMatch(/other-id|nope/);
    });

    it('always uses the configured session (never a caller-provided one)', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse({ id: 'true_1@c.us_A' }));

      await adapter().sendTextMessage(PHONE, 'session: default');

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body)).session).toBe(SESSION);
    });
  });

  describe('phone → direct chat id mapping', () => {
    it.each([
      ['5511999999999', '5511999999999@c.us'],
      ['+5511999999999', '5511999999999@c.us'],
      ['11999999999', '5511999999999@c.us'],
      ['+11999999999', '5511999999999@c.us'],
      // E.164 boundary: the FINAL normalized digit count is what must fit 15.
      ['1198765432100', '551198765432100@c.us'],
      ['551198765432100', '551198765432100@c.us'],
    ])('maps %s to %s (same +55 rule as Evolution)', async (input, chatId) => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse({ id: 'true_1@c.us_A' }));

      await adapter().sendTextMessage(input, TEXT);

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body)).chatId).toBe(chatId);
    });

    // P3.2 correction 1 — display formatting tolerated like the Evolution leaf
    // (`evolution-service.ts:219-224` strips non-digits), never widening the
    // accepted destination forms: no `@` of any kind, no letters, ≤15 digits.
    it.each([
      ['(11) 98765-4321', '5511987654321@c.us'],
      ['(11) 98765 4321', '5511987654321@c.us'],
      ['11 98765-4321', '5511987654321@c.us'],
      ['11.98765.4321', '5511987654321@c.us'],
      ['1198765-4321', '5511987654321@c.us'],
      ['  (11) 98765-4321  ', '5511987654321@c.us'],
      ['+55 (11) 98765-4321', '5511987654321@c.us'],
      ['+55.11.98765-4321', '5511987654321@c.us'],
      ['+55 (11) 98765 4321', '5511987654321@c.us'],
    ])('strips display formatting from %s', async (input, chatId) => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse({ id: 'true_1@c.us_A' }));

      await adapter().sendTextMessage(input, TEXT);

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(String(init.body)).chatId).toBe(chatId);
    });

    it.each([
      ['group jid', '120363000000000000@g.us'],
      ['lid', '123456789012345@lid'],
      ['broadcast', 'status@broadcast'],
      ['newsletter', '1234567890@newsletter'],
      ['device jid', '5511999999999:12@s.whatsapp.net'],
      ['caller-supplied jid', '5511999999999@c.us'],
      ['empty', ''],
      ['non numeric', '5511AAAA9999'],
      ['too long', '55119999999999999999'],
      // Formatting must not become a bypass for the rules above.
      ['formatted group jid', '(11) 98765-4321@g.us'],
      ['formatted lid', '+55 (11) 98765-4321@lid'],
      ['letters after formatting', '55 11 98765-4321 ext 5'],
      ['formatting without digits', '()-.  '],
      ['inner plus', '55+1199999999'],
      ['formatted too long', '+55 (11) 98765-4321 9999'],
      // Prefixing 55 must not push the final JID past E.164 (15 digits).
      ['14-digit non-55', '11111111111111'],
      ['15-digit non-55', '111111111111111'],
      ['formatted 14-digit non-55', '+44 (020) 1234-56789'],
    ])('rejects a non-direct destination (%s) without any request', async (_label, input) => {
      setValidConfig();

      const error = await captureError(adapter().sendTextMessage(input, TEXT));

      expect(error.code).toBe('invalid_destination');
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('rejects empty text without any request', async () => {
      setValidConfig();

      const error = await captureError(adapter().sendTextMessage(PHONE, '   '));

      expect(error.code).toBe('invalid_text');
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe('sanitized failures', () => {
    it.each([
      ['missing id', {}],
      ['empty id', { id: '' }],
      ['blank id', { id: '   ' }],
      ['non-string id', { id: 42 }],
      ['only _data.id', { _data: { id: 'true_1@c.us_A' } }],
      ['array body', []],
    ])('rejects a malformed response (%s) as invalid_response', async (_label, body) => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse(body));

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('invalid_response');
    });

    it('rejects a non-JSON body as invalid_response', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: null,
        text: async () => 'not-json',
      } as unknown as Response);

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('invalid_response');
    });

    it.each([400, 401, 404, 429, 500, 502, 503])(
      'maps HTTP %i to http_error with the status and a single attempt',
      async (status) => {
        setValidConfig();
        fetchImpl.mockResolvedValue(
          jsonResponse({ message: `boom ${PHONE} ${TEXT} ${API_KEY}` }, status),
        );

        const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

        expect(error.code).toBe('http_error');
        expect(error.status).toBe(status);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
      },
    );

    it('maps a transport failure to network_error with a single attempt (no retry)', async () => {
      setValidConfig();
      fetchImpl.mockRejectedValue(new TypeError('fetch failed'));

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('network_error');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('never leaks recipient, text, api key, provider body or url in the error', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse({ message: 'nope', phone: PHONE }, 500));

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      const serialized = `${error.message} ${JSON.stringify(error)} ${String((error as { stack?: string }).stack ?? '')}`;
      expect(serialized).not.toContain(API_KEY);
      expect(serialized).not.toContain(PHONE);
      expect(serialized).not.toContain(TEXT);
      expect(serialized).not.toContain(API_URL);
      expect(serialized).not.toContain('fetch failed');
      expect(error.message).not.toContain('nope');
      // Sem `cause`: exceção crua do transporte não é repassada.
      expect((error as { cause?: unknown }).cause).toBeUndefined();
    });

    it('logs only sanitized fields (no recipient, text or api key)', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse({ message: 'nope' }, 500));

      await captureError(adapter().sendTextMessage(PHONE, TEXT));

      const logged = JSON.stringify({
        warn: mockLogger.warn.mock.calls,
        error: mockLogger.error.mock.calls,
        info: mockLogger.info.mock.calls,
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(logged).not.toContain(API_KEY);
      expect(logged).not.toContain(PHONE);
      expect(logged).not.toContain(TEXT);
      expect(logged).toContain('http_error');
    });

    it('marks post-dispatch failures as delivery unknown (no auto-resend signal)', async () => {
      setValidConfig();
      fetchImpl.mockRejectedValue(new TypeError('fetch failed'));

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect((error as { delivery?: string }).delivery).toBe('unknown');
    });

    it('marks pre-dispatch rejections as not attempted', async () => {
      clearWahaConfig();

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect((error as { delivery?: string }).delivery).toBe('not_attempted');
    });
  });

  describe('redirect policy', () => {
    it('sets redirect: "error" so api key and text are never forwarded', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(jsonResponse({ id: 'true_1@c.us_A' }));

      await adapter().sendTextMessage(PHONE, TEXT);

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(init.redirect).toBe('error');
    });

    it('maps a fetch rejection to a sanitized network_error (single attempt)', async () => {
      setValidConfig();
      fetchImpl.mockRejectedValue(new TypeError('fetch failed'));

      const error = await captureError(adapter().sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('network_error');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('end-to-end deadline', () => {
    it('times out while waiting for headers, with a single attempt', async () => {
      setValidConfig();
      fetchImpl.mockImplementation(() => new Promise(() => undefined));

      const error = await captureError(adapter({ timeoutMs: 25 }).sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('timeout');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect((error as { delivery?: string }).delivery).toBe('unknown');
    });

    it('times out while the body stalls (deadline covers body consumption)', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(stalledStreamResponse());

      const error = await captureError(adapter({ timeoutMs: 25 }).sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('timeout');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('does not wait for the body when the deadline already elapsed', async () => {
      setValidConfig();
      fetchImpl.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return stalledStreamResponse();
      });

      const error = await captureError(adapter({ timeoutMs: 20 }).sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('timeout');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    // P3.2 correction 2 — the error-body release is bounded by the SAME
    // deadline: a cancel that never settles must not hang or outlive it.
    it('times out when an HTTP-error body cancellation hangs, without a second fetch', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue(hangingCancelResponse(503));

      const startedAt = Date.now();
      const error = await captureError(adapter({ timeoutMs: 40 }).sendTextMessage(PHONE, TEXT));
      const elapsed = Date.now() - startedAt;

      expect(error.code).toBe('timeout');
      expect((error as { delivery?: string }).delivery).toBe('unknown');
      // Bounded: rejects at the deadline, never hangs until the test timeout.
      expect(elapsed).toBeGreaterThanOrEqual(20);
      expect(elapsed).toBeLessThan(2_000);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('still maps a fast HTTP-error body release to http_error', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue({
        ok: false,
        status: 502,
        headers: new Headers(),
        body: { cancel: async () => undefined },
        text: async () => 'nope',
      } as unknown as Response);

      const error = await captureError(adapter({ timeoutMs: 2_000 }).sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('http_error');
      expect(error.status).toBe(502);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    // The release is best-effort: a failing cancel must never mask the HTTP
    // status nor escape as an unhandled rejection.
    it.each([
      ['cancel rejects', async () => Promise.reject(new Error('cancel failed'))],
      ['cancel throws', () => {
        throw new Error('cancel exploded');
      }],
    ])('keeps http_error when the body release fails (%s)', async (_label, cancel) => {
      setValidConfig();
      fetchImpl.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        body: { cancel },
        text: async () => 'nope',
      } as unknown as Response);

      const error = await captureError(adapter({ timeoutMs: 2_000 }).sendTextMessage(PHONE, TEXT));

      expect(error.code).toBe('http_error');
      expect(error.status).toBe(500);
      expect(error.message).not.toMatch(/cancel/);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('rejects an oversized content-length without reading the body', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '999999' }),
        body: null,
        text: jest.fn(),
      } as unknown as Response);

      const error = await captureError(
        adapter({ maxResponseBytes: 64 }).sendTextMessage(PHONE, TEXT),
      );

      expect(error.code).toBe('response_too_large');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    // Declared-oversize must RELEASE the body under the attempt deadline and
    // abort the transport — a body we never read must not stay open.
    it('releases and aborts when a declared oversized body cancels quickly', async () => {
      setValidConfig();
      const cancel = jest.fn().mockResolvedValue(undefined);
      fetchImpl.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '999999' }),
        body: { cancel },
        text: jest.fn(),
      } as unknown as Response);

      const error = await captureError(
        adapter({ maxResponseBytes: 64, timeoutMs: 2_000 }).sendTextMessage(PHONE, TEXT),
      );

      expect(error.code).toBe('response_too_large');
      expect(cancel).toHaveBeenCalledTimes(1);
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect((init.signal as AbortSignal).aborted).toBe(true);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe('response size bound', () => {
    it('rejects an oversized response body without parsing it', async () => {
      setValidConfig();
      const payload = encoder.encode(JSON.stringify({ id: 'true_1@c.us_A', pad: 'x'.repeat(4096) }));
      fetchImpl.mockResolvedValue(streamResponse([payload]));

      const error = await captureError(
        adapter({ maxResponseBytes: 64 }).sendTextMessage(PHONE, TEXT),
      );

      expect(error.code).toBe('response_too_large');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('lets the deadline win and still abort when a declared oversized cancel stalls', async () => {
      setValidConfig();
      fetchImpl.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-length': '999999' }),
        body: { cancel: () => new Promise<never>(() => undefined) },
        text: jest.fn(),
      } as unknown as Response);

      const startedAt = Date.now();
      const error = await captureError(
        adapter({ maxResponseBytes: 64, timeoutMs: 40 }).sendTextMessage(PHONE, TEXT),
      );
      const elapsed = Date.now() - startedAt;

      expect(error.code).toBe('timeout');
      expect((error as { delivery?: string }).delivery).toBe('unknown');
      expect(elapsed).toBeLessThan(2_000);
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect((init.signal as AbortSignal).aborted).toBe(true);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('reads a streamed body within the bound', async () => {
      setValidConfig();
      const payload = encoder.encode(JSON.stringify({ id: 'true_1@c.us_A' }));
      fetchImpl.mockResolvedValue(streamResponse([payload]));

      const result = await adapter({ maxResponseBytes: 4096 }).sendTextMessage(PHONE, TEXT);

      expect(result).toEqual({ success: true, messageId: 'true_1@c.us_A' });
    });
  });

  describe('dormancy', () => {
    it('configuring WAHA does not change the facade provider selection', async () => {
      setValidConfig();
      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'evo-key';
      const evolutionSend = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-1' });
      mockGetEvolutionService.mockReturnValue({ sendTextMessage: evolutionSend } as never);

      const res = await sendWhatsAppMessage(PHONE, TEXT);

      expect(res).toEqual({ success: true, messageId: 'evo-1' });
      expect(evolutionSend).toHaveBeenCalledWith(PHONE, TEXT);
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('a fully configured WAHA adapter is available without being selected', () => {
      setValidConfig();

      expect(wahaWhatsAppProviderAdapter.isAvailable()).toBe(true);
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  });
});
