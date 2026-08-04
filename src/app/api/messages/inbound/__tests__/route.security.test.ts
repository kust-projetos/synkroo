import { NextRequest } from 'next/server';
import { POST } from '../route';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';

jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (handler: unknown) => handler }));
jest.mock('@/core/modules/manifest', () => ({ moduleManifest: {} }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  getClientIdentifier: () => 'test-client',
  rateLimitPresets: { webhook: {} },
}));
jest.mock('@/modules/atendimento/integrations/resolve-channel-installation');
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemAction: jest.fn().mockResolvedValue(new Response(null, { status: 201 })),
}));

describe('inbound webhook tenant boundary', () => {
  it('ignores forged clinicId and uses installation clinic', async () => {
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
        message: 'Olá',
      }),
    });

    await POST(request);

    expect(runAtendimentoSystemAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ clinicId: 'attacker-clinic' }),
      'victim-clinic',
      expect.anything(),
    );
  });
});
