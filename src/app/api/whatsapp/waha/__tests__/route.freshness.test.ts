/**
 * POST /api/whatsapp/waha — freshness / replay guard.
 *
 * The replay-relevant clock is the SIGNED root `timestamp` (milliseconds) that
 * the HMAC covers. `X-Webhook-Timestamp` is a separate UNSIGNED header and must
 * never be trusted, and `payload.timestamp` (seconds) is the message clock —
 * neither may stand in for the signed root timestamp.
 */
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

const mockResolveEnabledChannelInstallation = jest.fn();
const mockRunAtendimentoSystemActionResult = jest.fn();

// Real module gate, mocked enabled manifest: freshness/replay behavior must be
// verified THROUGH the gate, not around it.
const mockCreateManifest = jest.fn();
const mockIsEnabled = jest.fn(async () => true);
jest.mock('@/core/modules/manifest', () => ({
  createManifest: (...args: unknown[]) => mockCreateManifest(...args),
}));
jest.mock('@/modules/atendimento/integrations/resolve-channel-installation', () => ({
  resolveWahaInstallationStrict: (...args: unknown[]) => mockResolveEnabledChannelInstallation(...args),
}));
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemActionResult: (...args: unknown[]) => mockRunAtendimentoSystemActionResult(...args),
}));
jest.mock('@/lib/logger', () => {
  const loggerMock = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { logger: loggerMock, whatsappLogger: loggerMock, dbLogger: loggerMock };
});
// Isolate the in-memory limiter: these cases must not consume (or share) the
// real 100/min webhook budget. Allowed by default; the blocked path is covered
// in route.test.ts.
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 99, resetTime: 0 })),
  getClientIdentifier: jest.fn(() => 'freshness-client'),
  rateLimitPresets: {
    webhook: { windowMs: 60000, maxRequests: 100 },
  },
}));

import { POST } from '../route';

const HMAC_KEY = 'waha-hmac-key-for-tests-at-least-32-chars';
const SESSION = 'default';
const NOW = 1_800_000_000_000;
const PHONE = '5511999999999';

function signed(body: string, extraHeaders: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/whatsapp/waha', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-hmac': createHmac('sha512', HMAC_KEY).update(body).digest('hex'),
      'x-webhook-hmac-algorithm': 'sha512',
      ...extraHeaders,
    },
    body,
  });
}

/** Envelope whose payload carries its own (seconds) clock, independent of the root one. */
function envelope(rootTimestamp: unknown, payloadTimestampSec: number = Math.floor(NOW / 1000) - 60) {
  return JSON.stringify({
    event: 'message',
    session: SESSION,
    ...(rootTimestamp === undefined ? {} : { timestamp: rootTimestamp }),
    payload: {
      id: 'fresh-1',
      timestamp: payloadTimestampSec,
      from: `${PHONE}@c.us`,
      fromMe: false,
      body: 'oi',
      hasMedia: false,
    },
  });
}

describe('waha webhook freshness — signed root timestamp only', () => {
  const originalKey = process.env.WAHA_WEBHOOK_HMAC_KEY;
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WAHA_WEBHOOK_HMAC_KEY = HMAC_KEY;
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockCreateManifest.mockReturnValue({ isEnabled: mockIsEnabled });
    mockIsEnabled.mockResolvedValue(true);
    mockResolveEnabledChannelInstallation.mockResolvedValue({ installationId: SESSION, clinicId: 'clinic-1' });
    mockRunAtendimentoSystemActionResult.mockResolvedValue({ ok: true, data: { deduped: false } });
  });

  afterEach(() => nowSpy.mockRestore());

  afterAll(() => {
    if (originalKey === undefined) delete process.env.WAHA_WEBHOOK_HMAC_KEY;
    else process.env.WAHA_WEBHOOK_HMAC_KEY = originalKey;
  });

  it('processes a fresh signed root timestamp', async () => {
    const res = await POST(signed(envelope(NOW - 60_000)));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale signed root timestamp (>10min) with 409 and no side effect', async () => {
    const res = await POST(signed(envelope(NOW - 3_600_000)));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Stale webhook event' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a far-future signed root timestamp (>5min skew) with 409 and no side effect', async () => {
    const res = await POST(signed(envelope(NOW + 3_600_000)));

    expect(res.status).toBe(409);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('rejects a MISSING signed root timestamp (fail closed, no fail-open)', async () => {
    const res = await POST(signed(envelope(undefined)));

    expect(res.status).toBe(409);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['string-garbage', 'ontem'],
    ['boolean', true],
    ['object', { at: NOW }],
    ['array', [NOW]],
    ['null', null],
  ])('rejects an invalid signed root timestamp (%s) with 409', async (_label, value) => {
    const res = await POST(signed(envelope(value)));

    expect(res.status).toBe(409);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('accepts a numeric-string signed root timestamp (WAHA serializes numbers as strings sometimes)', async () => {
    const res = await POST(signed(envelope(String(NOW - 60_000))));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).toHaveBeenCalledTimes(1);
  });

  it('is deterministic exactly at the age boundary (inclusive → processes)', async () => {
    const res = await POST(signed(envelope(NOW - 600_000)));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).toHaveBeenCalledTimes(1);
  });

  it('IGNORES the unsigned X-Webhook-Timestamp header: stale body + fresh header is still rejected', async () => {
    const res = await POST(signed(envelope(NOW - 3_600_000), { 'x-webhook-timestamp': String(NOW) }));

    expect(res.status).toBe(409);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('IGNORES the unsigned X-Webhook-Timestamp header: fresh body + stale header still processes', async () => {
    const res = await POST(signed(envelope(NOW - 60_000), { 'x-webhook-timestamp': '1' }));

    expect(res.status).toBe(200);
    expect(mockRunAtendimentoSystemActionResult).toHaveBeenCalledTimes(1);
  });

  it('IGNORES the unsigned X-Webhook-Request-Id header for freshness', async () => {
    const res = await POST(signed(envelope(NOW - 3_600_000), { 'x-webhook-request-id': 'req-1' }));

    expect(res.status).toBe(409);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('does NOT accept the payload (seconds) timestamp as a freshness substitute', async () => {
    // Root timestamp is already stale; a fresh payload timestamp must not rescue it.
    const res = await POST(signed(envelope(NOW - 3_600_000, Math.floor(NOW / 1000))));

    expect(res.status).toBe(409);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('replays-check EVERY valid inbound direct message: a stale INBOUND event is rejected', async () => {
    const body = JSON.stringify({
      event: 'message',
      session: SESSION,
      timestamp: NOW - 3_600_000,
      payload: {
        id: 'stale-inbound-1', timestamp: Math.floor(NOW / 1000),
        from: `${PHONE}@c.us`, fromMe: false, body: 'x', hasMedia: false,
      },
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Stale webhook event' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('acknowledges a stale outbound ECHO as ignored instead of making WAHA retry it', async () => {
    // Signature and session lookup still precede this ignore (no HMAC bypass):
    // the echo is acknowledged only because it is authenticated and routed.
    const body = JSON.stringify({
      event: 'message',
      session: SESSION,
      timestamp: NOW - 3_600_000,
      payload: { id: 'echo-1', timestamp: Math.floor(NOW / 1000), from: `${PHONE}@c.us`, fromMe: true, body: 'x' },
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockResolveEnabledChannelInstallation).toHaveBeenCalledWith({ installationId: SESSION });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it.each([
    ['an unsupported sender', { id: 'g-1', from: '120363000000000000@g.us', fromMe: false, body: 'x' }],
    ['a missing message id', { id: undefined, from: `${PHONE}@c.us`, fromMe: false, body: 'x' }],
    ['an empty message id', { id: '   ', from: `${PHONE}@c.us`, fromMe: false, body: 'x' }],
  ])('acknowledges a stale event we would ignore anyway (%s)', async (_label, payload) => {
    const body = JSON.stringify({
      event: 'message',
      session: SESSION,
      timestamp: NOW - 3_600_000,
      payload: { timestamp: Math.floor(NOW / 1000), hasMedia: false, ...payload },
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  it('still rejects an unsigned/fresh-header stale INBOUND message (no echo shortcut for inbound)', async () => {
    const body = JSON.stringify({
      event: 'message',
      session: SESSION,
      timestamp: NOW - 3_600_000,
      payload: {
        id: 'inbound-2', timestamp: Math.floor(NOW / 1000),
        from: `${PHONE}@c.us`, fromMe: false, body: 'x', hasMedia: false,
      },
    });

    const res = await POST(signed(body, { 'x-webhook-timestamp': String(NOW) }));

    expect(res.status).toBe(409);
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });

  // Review correction: content processability is decided BEFORE the replay
  // guard, so a stale event we would never store is acknowledged once instead
  // of being retried forever with 409.
  it.each([
    ['unsupported media', { id: 'm-1', from: `${PHONE}@c.us`, fromMe: false, body: '', hasMedia: true, media: { mimetype: 'video/mp4', filename: 'clip.mp4' } }],
    ['empty text', { id: 'm-2', from: `${PHONE}@c.us`, fromMe: false, body: '   ', hasMedia: false }],
  ])('acknowledges a stale unprocessable message as ignored, not 409 (%s)', async (_label, payload) => {
    const body = JSON.stringify({
      event: 'message',
      session: SESSION,
      timestamp: NOW - 3_600_000,
      payload: { timestamp: Math.floor(NOW / 1000), ...payload },
    });

    const res = await POST(signed(body));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'ignored' });
    expect(mockRunAtendimentoSystemActionResult).not.toHaveBeenCalled();
  });
});