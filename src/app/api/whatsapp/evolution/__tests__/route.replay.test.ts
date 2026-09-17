/**
 * Etapa 6.3 — Evolution webhook same-payload replay (Etapa 6.3 residual).
 *
 * The route has no route-level dedup table: replay protection is the stable
 * downstream dedup key (`externalMessageId`) forwarded to `receberMensagem`,
 * which dedups via unique `(externalProvider, externalMessageId)`
 * (`persistInboundMessage` → `onConflictDoNothing`; single-row proof in
 * `src/modules/atendimento/__tests__/gates/integration.test.ts`, no-side-effect
 * proof in `webhook-processor-service.test.ts`).
 *
 * This test proves the route half of the contract: delivering the SAME event
 * payload twice forwards byte-identical action input (same `externalMessageId`)
 * and never rejects the replay itself — so the downstream dedup can collapse
 * it into a single message row.
 */

import { NextRequest, NextResponse } from 'next/server';

const mockResolveChannelInstallation = jest.fn();
const mockRunAtendimentoSystemAction = jest.fn();

jest.mock('@/modules/atendimento/integrations/resolve-channel-installation', () => ({
  resolveChannelInstallation: (...args: unknown[]) => mockResolveChannelInstallation(...args),
}));

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

const INSTALLATION = { installationId: 'replay-inst', clinicId: 'clinic-replay' };

// No timestamp fields → freshness gate is fail-open (warn) by design; both
// deliveries reach the downstream action, which owns the dedup.
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

describe('evolution webhook same-payload replay (Etapa 6.3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveChannelInstallation.mockResolvedValue(INSTALLATION);
    mockRunAtendimentoSystemAction.mockResolvedValue(
      NextResponse.json({ success: true }, { status: 200 }) as unknown as NextResponse<unknown>,
    );
  });

  it('same event twice → same downstream dedup key, replay never rejected', async () => {
    const first = await POST(makeRequest(replayPayload()));
    const second = await POST(makeRequest(replayPayload()));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockRunAtendimentoSystemAction).toHaveBeenCalledTimes(2);

    const firstInput = mockRunAtendimentoSystemAction.mock.calls[0][1];
    const secondInput = mockRunAtendimentoSystemAction.mock.calls[1][1];
    // Replay determinism: identical dedup identity downstream.
    expect(secondInput).toEqual(firstInput);
    expect(firstInput).toMatchObject({
      externalProvider: 'evolution',
      externalMessageId: 'EVT-REPLAY-1',
      externalConversationId: '5511999999999',
      message: 'Olá, replay',
      channel: 'whatsapp',
    });
  });
});
