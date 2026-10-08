/**
 * Evolution webhook replay — retired (410 Gone).
 *
 * WAHA-only (owner decision, commit 3863c4f, ratified 2026-10-08): the route
 * no longer forwards anything downstream, so there is no replay contract left
 * to prove here. This test pins the retired behavior: the same payload
 * delivered twice is answered 410 both times and never reaches the
 * atendimento action layer.
 */

import { NextRequest, NextResponse } from 'next/server';

const mockRunAtendimentoSystemAction = jest.fn();

jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemAction: (...args: unknown[]) => mockRunAtendimentoSystemAction(...args),
}));

jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (handler: unknown) => handler,
}));

jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));

jest.mock('@/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { POST } from '../route';

function replayPayload() {
  return {
    event: 'messages.upsert',
    instance: 'replay-inst',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'EVT-REPLAY-1' },
      message: { conversation: 'Olá, replay' },
    },
  };
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/whatsapp/evolution', {
    method: 'POST',
    headers: { 'X-Webhook-Secret': 'valid-secret', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('evolution webhook replay — retired (410, no downstream)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunAtendimentoSystemAction.mockResolvedValue(
      NextResponse.json({ success: true }, { status: 200 }) as unknown as NextResponse<unknown>,
    );
  });

  it('same event twice → 410 both times, downstream never reached', async () => {
    const first = await POST(makeRequest(replayPayload()));
    const second = await POST(makeRequest(replayPayload()));

    expect(first.status).toBe(410);
    expect(second.status).toBe(410);
    expect(await first.json()).toMatchObject({ error: { code: 'EVOLUTION_RETIRED' } });
    expect(await second.json()).toMatchObject({ error: { code: 'EVOLUTION_RETIRED' } });
    expect(mockRunAtendimentoSystemAction).not.toHaveBeenCalled();
  });
});
