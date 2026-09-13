import { NextRequest } from 'next/server';
import { POST } from '../route';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { checkRateLimit } from '@/lib/rate-limit';

jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (handler: unknown) => handler }));
jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true }),
  rateLimitPresets: { webhook: {} },
}));
jest.mock('@/modules/atendimento/integrations/resolve-channel-installation');
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemAction: jest.fn().mockResolvedValue(new Response(null, { status: 201 })),
}));

describe('inbound webhook tenant boundary and fail-closed validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 10, reset: 60 } as any);
  });

  it('rejects when the tenant rate limit is exceeded with 429 (after auth)', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue({
      installationId: 'inst-1',
      clinicId: 'clinic-123',
    });
    jest.mocked(checkRateLimit).mockReturnValue({ allowed: false, remaining: 0, reset: 60 } as any);

    const request = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'valid-secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'inst-1',
        from: '+5511999999999',
        message: 'Oi',
        externalMessageId: 'ext-1',
        channel: 'whatsapp',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(resolveChannelInstallation).toHaveBeenCalled();
    // Tenant-scoped bucket: keyed by resolved clinic, never by raw client input.
    expect(checkRateLimit).toHaveBeenCalledWith(
      'tenant:clinic-123',
      expect.objectContaining({ keyPrefix: 'msg-inbound' }),
    );
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('does not consume the tenant quota for unauthenticated or invalid requests', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'bad-secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'attacker-installation',
        from: '+5511999999999',
        message: 'Oi',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    // Auth runs first; the tenant bucket is only touched after successful auth.
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('rejects unknown or disabled channel installation with 403', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'bad-secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'unknown-installation',
        from: '+5511999999999',
        message: 'Olá',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data).toEqual({ error: 'Invalid webhook' });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('rejects missing installationId in payload with 403', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        from: '+5511999999999',
        message: 'Olá',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(resolveChannelInstallation).toHaveBeenCalledWith({
      installationId: '',
      providedSecret: 'secret',
    });
    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('rejects missing required message fields (from or message) with 400', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue({
      installationId: 'valid-installation',
      clinicId: 'clinic-123',
    });

    const requestWithoutFrom = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'valid-installation',
        message: 'Olá sem from',
      }),
    });
    const res1 = await POST(requestWithoutFrom);
    expect(res1.status).toBe(400);

    const requestWithoutMessage = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'valid-installation',
        from: '+5511999999999',
      }),
    });
    const res2 = await POST(requestWithoutMessage);
    expect(res2.status).toBe(400);

    expect(runAtendimentoSystemAction).not.toHaveBeenCalled();
  });

  it('ignores forged clinicId and strictly uses installation clinic for tenant boundary', async () => {
    jest.mocked(resolveChannelInstallation).mockResolvedValue({
      installationId: 'victim-installation',
      clinicId: 'victim-clinic',
    });

    const request = new NextRequest('http://localhost/api/messages/inbound', {
      method: 'POST',
      headers: { 'x-webhook-secret': 'secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        installationId: 'victim-installation',
         clinicId: 'attacker-clinic',
         from: '+5511999999999',
         externalMessageId: 'inbound-1',
         message: 'Olá',
        channel: 'whatsapp',
        metadata: { customField: 'value' },
      }),
    });

    await POST(request);

    expect(runAtendimentoSystemAction).toHaveBeenCalledWith(
      expect.anything(),
      {
        externalConversationId: '+5511999999999',
        externalProvider: 'webhook',
        externalMessageId: 'inbound-1',
        message: 'Olá',
        channel: 'whatsapp',
        messageType: 'text',
        metadata: { customField: 'value' },
      },
      'victim-clinic',
      { okStatus: 201 },
    );
  });
});
