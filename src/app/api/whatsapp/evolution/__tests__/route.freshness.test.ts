import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { whatsappLogger } from '@/lib/logger';

jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (handler: unknown) => handler }));
jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));
jest.mock('@/modules/atendimento/integrations/resolve-channel-installation');
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemAction: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const NOW = 1_700_000_000_000;
const INSTALLATION = { installationId: 'test-inst', clinicId: 'clinic-123' };

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/whatsapp/evolution', {
    method: 'POST',
    headers: { 'X-Webhook-Secret': 'valid-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function evolutionPayload(timestamp: { date_time?: string; messageTimestamp?: number | string } = {}) {
  return {
    event: 'messages.upsert',
    instance: 'test-inst',
    ...(timestamp.date_time !== undefined ? { date_time: timestamp.date_time } : {}),
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'EVT-1' },
      message: { conversation: 'Olá' },
      ...(timestamp.messageTimestamp !== undefined ? { messageTimestamp: timestamp.messageTimestamp } : {}),
    },
  };
}

describe('evolution webhook freshness / replay guard (A4)', () => {
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    jest.mocked(resolveChannelInstallation).mockResolvedValue(INSTALLATION);
    jest.mocked(runAtendimentoSystemAction).mockResolvedValue(
      NextResponse.json({ success: true }, { status: 200 }) as unknown as NextResponse<unknown>,
    );
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('processes a fresh payload (200)', async () => {
    const res = await POST(
      buildRequest(evolutionPayload({
        date_time: new Date(NOW - 60_000).toISOString(),
        messageTimestamp: NOW / 1000 - 60,
      })),
    );
    expect(res.status).toBe(200);
    expect(runAtendimentoSystemAction).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale payload (>10min) with generic 409 and no side effects', async () => {
    const res = await POST(
      buildRequest(evolutionPayload({
        date_time: new Date(NOW - 3_600_000).toISOString(),
        messageTimestamp: NOW / 1000 - 3_600,
      })),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Stale webhook event' });
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
    expect(whatsappLogger.warn).toHaveBeenCalledWith(
      'evolution webhook stale event rejected',
      expect.objectContaining({ event: 'messages.upsert' }),
    );
  });

  it('rejects a far-future payload (>5min skew) with 409 and no side effects', async () => {
    const res = await POST(
      buildRequest(evolutionPayload({ messageTimestamp: NOW / 1000 + 3_600 })),
    );
    expect(res.status).toBe(409);
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('processes a payload with no timestamp (warn, dedup downstream remains)', async () => {
    const res = await POST(buildRequest(evolutionPayload()));
    expect(res.status).toBe(200);
    expect(runAtendimentoSystemAction).toHaveBeenCalledTimes(1);
    expect(whatsappLogger.warn).toHaveBeenCalledWith(
      'evolution webhook without timestamp, skipping freshness check',
      expect.objectContaining({ event: 'messages.upsert' }),
    );
    // No payload details leak into logs: only the event name travels as context.
    const loggedContexts = jest.mocked(whatsappLogger.warn).mock.calls.map((c) => JSON.stringify(c[1] ?? {}));
    for (const ctx of loggedContexts) {
      expect(ctx).not.toContain('5511999999999');
      expect(ctx).not.toContain('Ol\u00e1');
    }
  });

  it('is deterministic exactly at the age boundary (inclusive → processes)', async () => {
    const res = await POST(
      buildRequest(evolutionPayload({ messageTimestamp: NOW / 1000 - 600 })),
    );
    expect(res.status).toBe(200);
    expect(runAtendimentoSystemAction).toHaveBeenCalledTimes(1);
  });

  it('does not break fromMe callbacks (outbound echo short-circuits before freshness)', async () => {
    const payload = evolutionPayload({ messageTimestamp: NOW / 1000 - 3_600 });
    (payload.data.key as Record<string, unknown>).fromMe = true;
    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, processed: false, reason: 'outbound_callback' });
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('returns 400 (not 409) for an invalid payload even with a stale timestamp', async () => {
    const payload = evolutionPayload({ messageTimestamp: NOW / 1000 - 3_600 });
    // Valid key/id but no usable content → fails the pre-existing 400 validation.
    (payload.data as Record<string, unknown>).message = {};
    const res = await POST(buildRequest(payload));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid Evolution message payload' });
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('keeps invalid auth rejected (403, existing contract) without processing', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue(null);
    const res = await POST(
      buildRequest(evolutionPayload({ messageTimestamp: NOW / 1000 - 60 })),
    );
    expect(res.status).toBe(403);
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });
});
