import { NextRequest } from 'next/server';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn().mockResolvedValue({ id: 'user-1' }),
}));

import { middleware, isPublicPath } from '@/middleware';

describe('middleware security gates', () => {
  it.each([
    ['/api/health', true],
    ['/api/auth/signin', true],
    ['/api/whatsapp/evolution', true],
    ['/api/messages/inbound', false],
    ['/api/messages/send', false],
    ['/api/cron/cleanup', false],
    ['/api/agent/classify', false],
  ])('classifies %s as public=%s', (path, expected) => {
    expect(isPublicPath(path)).toBe(expected);
  });
  it('rejects cross-origin cookie mutations before route handling', async () => {
    const request = new NextRequest('https://app.example.test/api/action', {
      method: 'POST',
      headers: {
        cookie: 'next-auth.session-token=token',
        origin: 'https://evil.example',
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(403);
  });

  it('leaves NextAuth mutations to NextAuth CSRF validation', async () => {
    const request = new NextRequest('https://app.example.test/api/auth/signout', {
      method: 'POST',
      headers: {
        cookie: 'next-auth.session-token=token',
        origin: 'https://evil.example',
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(200);
  });

  it('rejects request bodies above the platform limit before authentication', async () => {
    const request = new NextRequest('https://app.example.test/api/action', {
      method: 'POST',
      headers: {
        'content-length': String(1_048_577),
      },
    });

    const response = await middleware(request);

    expect(response.status).toBe(413);
  });
});
