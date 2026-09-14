import { NextRequest } from 'next/server';
import { POST } from '../route';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { checkRateLimit } from '@/lib/rate-limit';

jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (handler: unknown) => handler }));
jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10, reset: 60 }),
  rateLimitPresets: { webhook: {} },
}));
jest.mock('@/modules/atendimento/integrations/resolve-channel-installation');
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemAction: jest.fn().mockResolvedValue(new Response(null, { status: 201 })),
}));

/**
 * A4 decision lock: the generic inbound contract carries no trustworthy event
 * timestamp, so no freshness window is enforced here. Replay protection is
 * shared secret + dedup by externalMessageId (+ tenant rate limit). This
 * suite pins the passthrough so a future freshness requirement cannot be
 * silently assumed — it must be an explicit contract change.
 */
describe('messages/inbound freshness decision (A4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 10, reset: 60 } as any);
    jest.mocked(resolveChannelInstallation).mockResolvedValue({
      installationId: 'inst-1',
      clinicId: 'clinic-123',
    });
  });

  it('processes an authenticated payload without any timestamp (201, no freshness gate)', async () => {
    const request = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'valid-secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'inst-1',
        from: '+5511999999999',
        message: 'Oi',
        externalMessageId: 'ext-no-ts-1',
        channel: 'whatsapp',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(runAtendimentoSystemAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ externalMessageId: 'ext-no-ts-1' }),
      'clinic-123',
      { okStatus: 201 },
    );
  });

  it('still rejects invalid auth before any processing (403)', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue(null);
    const request = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'bad-secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'inst-1',
        from: '+5511999999999',
        message: 'Oi',
        externalMessageId: 'ext-no-ts-2',
        channel: 'whatsapp',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });
});
