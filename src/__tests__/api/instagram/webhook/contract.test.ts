import { NextRequest } from 'next/server';

jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (handler: any) => handler,
}));
jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({}),
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { webhook: { windowMs: 60000, maxRequests: 100 } },
}));
jest.mock('@/modules/atendimento/repositories/conversations-repository', () => ({
  getClinicByInstagramAccountId: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/db/client', () => ({
  getDb: () => ({
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
      }),
    }),
  }),
}));
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemActionResult: jest.fn().mockResolvedValue({ ok: true, data: {} }),
}));
jest.mock('@/modules/atendimento/schema/integrations', () => ({
  channelInstallations: { installationId: 'installationId', clinicId: 'clinicId', provider: 'provider', enabled: 'enabled' },
}));

import { GET, POST } from '@/app/api/instagram/webhook/route';

describe('Instagram webhook contract — T2 enabled', () => {
  it('requires verification token (not 404)', async () => {
    const getResponse = await GET(new NextRequest('https://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123') as any);
    expect(getResponse.status).toBe(403);
    const postResponse = await POST(new NextRequest('https://localhost/api/instagram/webhook', { method: 'POST', body: JSON.stringify({ object: 'instagram', entry: [] }) }) as any);
    // POST without signature is 403, not 404 — handler validates HMAC
    expect(postResponse.status).toBe(403);
  });
});
