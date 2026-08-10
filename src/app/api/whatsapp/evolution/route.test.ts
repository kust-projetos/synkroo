import { NextRequest } from 'next/server';

const mockProcessEvolutionMessage = jest.fn();
const mockResolveChannelInstallation = jest.fn();

jest.mock('@/modules/atendimento/services/webhook-processor-service', () => ({
  processEvolutionMessage: (...args: unknown[]) => mockProcessEvolutionMessage(...args),
}));

jest.mock('@/modules/atendimento/integrations/resolve-channel-installation', () => ({
  resolveChannelInstallation: (...args: unknown[]) => mockResolveChannelInstallation(...args),
}));

jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (handler: unknown) => handler,
}));

jest.mock('@/core/modules/manifest', () => ({ moduleManifest: {} }));

import { POST } from './route';

function makeRequest(url: string, headers: Record<string, string> = {}, body: Record<string, unknown> = { event: 'Connected', instance: 'ted', data: {} }) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('Evolution webhook authentication', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecret = process.env.EVOLUTION_WEBHOOK_SECRET;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    process.env.EVOLUTION_WEBHOOK_SECRET = 'test-evolution-secret';
    mockProcessEvolutionMessage.mockReset();
    mockResolveChannelInstallation.mockReset();
    mockResolveChannelInstallation.mockResolvedValue({ installationId: 'ted', clinicId: 'clinic-1' });
  });
  afterAll(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
    if (originalSecret === undefined) delete process.env.EVOLUTION_WEBHOOK_SECRET;
    else process.env.EVOLUTION_WEBHOOK_SECRET = originalSecret;
  });

  it('accepts Evolution Go query-token webhooks', async () => {
    const response = await POST(makeRequest(
      'http://localhost/api/whatsapp/evolution?token=test-evolution-secret',
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ignored', event: 'Connected' });
  });

  it('prefers the authenticated header when provided', async () => {
    const response = await POST(makeRequest(
      'http://localhost/api/whatsapp/evolution?token=wrong',
      { 'x-webhook-secret': 'test-evolution-secret' },
    ));

    expect(response.status).toBe(200);
  });

  it('normalizes an Evolution Go Message event before processing', async () => {
    mockProcessEvolutionMessage.mockResolvedValue([{ from: '5511999999999', action: 'received' }]);
    const response = await POST(new NextRequest(
      'http://localhost/api/whatsapp/evolution?token=test-evolution-secret',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'Message',
          instanceName: 'ted',
          data: {
            Info: { ID: 'go-message-1', Chat: '5511999999999@s.whatsapp.net', IsFromMe: false },
            Message: { Conversation: 'Oi do Evolution Go' },
          },
        }),
      },
    ));

    expect(response.status).toBe(200);
    expect(mockProcessEvolutionMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        key: expect.objectContaining({ id: 'go-message-1', remoteJid: '5511999999999@s.whatsapp.net' }),
        message: { conversation: 'Oi do Evolution Go' },
      }),
      'ted',
    );
  });

  it('accepts Evolution Go SendMessage callbacks for outbound delivery', async () => {
    mockProcessEvolutionMessage.mockResolvedValue([]);
    const response = await POST(new NextRequest(
      'http://localhost/api/whatsapp/evolution?token=test-evolution-secret',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'SendMessage',
          instanceName: 'ted',
          data: {
            Info: { ID: 'go-send-1', Chat: '5511999999999@s.whatsapp.net', IsFromMe: true },
            Message: { Conversation: 'Canary' },
          },
        }),
      },
    ));

    expect(response.status).toBe(200);
    expect(mockProcessEvolutionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.objectContaining({ id: 'go-send-1', fromMe: true }) }),
      'ted',
    );
  });

  it('rejects invalid Evolution Go query tokens in production', async () => {
    mockResolveChannelInstallation.mockResolvedValue(null);
    const response = await POST(makeRequest(
      'http://localhost/api/whatsapp/evolution?token=wrong',
    ));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid Evolution installation' });
  });
  it('rejects a missing instance without fallback', async () => {
    mockResolveChannelInstallation.mockResolvedValue(null);
    const response = await POST(makeRequest(
      'http://localhost/api/whatsapp/evolution?token=test-evolution-secret',
      {},
      { event: 'messages.upsert', data: { key: { remoteJid: '5511999999999@s.whatsapp.net' } } },
    ));

    expect(response.status).toBe(403);
    expect(mockResolveChannelInstallation).toHaveBeenCalledWith({
      installationId: '',
      providedSecret: 'test-evolution-secret',
      provider: 'evolution',
    });
  });

  it('rejects an unknown or disabled installation', async () => {
    mockResolveChannelInstallation.mockResolvedValue(null);

    const response = await POST(makeRequest(
      'http://localhost/api/whatsapp/evolution?token=test-evolution-secret',
      {},
      { event: 'messages.upsert', instance: 'unknown-instance', data: { key: { remoteJid: '5511999999999@s.whatsapp.net' } } },
    ));

    expect(response.status).toBe(403);
    expect(mockProcessEvolutionMessage).not.toHaveBeenCalled();
  });

  it('rejects cross-installation spoofing', async () => {
    mockResolveChannelInstallation.mockImplementation(({ installationId, providedSecret }: { installationId: string; providedSecret: string }) => {
      if (installationId === 'victim-instance' && providedSecret === 'attacker-secret') return null;
      return { installationId, clinicId: 'victim-clinic' };
    });

    const response = await POST(makeRequest(
      'http://localhost/api/whatsapp/evolution?token=attacker-secret',
      {},
      { event: 'messages.upsert', instance: 'victim-instance', data: { key: { remoteJid: '5511999999999@s.whatsapp.net' } } },
    ));

    expect(response.status).toBe(403);
    expect(mockProcessEvolutionMessage).not.toHaveBeenCalled();
  });
});
