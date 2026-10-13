/**
 * Evolution webhook freshness — retired (410 Gone).
 *
 * WAHA-only (owner decision, commit 3863c4f, ratified 2026-10-08): the route
 * no longer authenticates, validates, or freshness-gates anything. Fresh,
 * stale, and timestamp-less payloads all get the same 410 retirement signal
 * with no side effects.
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';

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

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/whatsapp/evolution', {
    method: 'POST',
    headers: { 'X-Webhook-Secret': 'valid-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function evolutionPayload(messageTimestamp?: number) {
  return {
    event: 'messages.upsert',
    instance: 'test-inst',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'EVT-1' },
      message: { conversation: 'Olá' },
      ...(messageTimestamp !== undefined ? { messageTimestamp } : {}),
    },
  };
}

describe('evolution webhook freshness — retired (410, no gates)', () => {
  let nowSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
    jest.mocked(runAtendimentoSystemAction).mockResolvedValue(
      NextResponse.json({ success: true }, { status: 200 }) as unknown as NextResponse<unknown>,
    );
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  it.each([
    ['fresh payload', NOW / 1000 - 60],
    ['stale payload', NOW / 1000 - 3_600],
    ['far-future payload', NOW / 1000 + 3_600],
  ])('%s → 410 with no side effects', async (_label, messageTimestamp) => {
    const res = await POST(buildRequest(evolutionPayload(messageTimestamp)));

    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ error: { code: 'EVOLUTION_RETIRED' } });
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('payload with no timestamp → 410 with no side effects', async () => {
    const res = await POST(buildRequest(evolutionPayload()));

    expect(res.status).toBe(410);
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });
});
