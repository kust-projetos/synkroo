jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/lib/security/request-guards', () => ({
  exceedsBodyLimit: jest.fn(() => false),
  shouldRejectCsrf: jest.fn(() => false),
}));

import { getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { middleware, isPublicPath } from '../middleware';

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;

function request(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('middleware coverage tranche', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetToken.mockResolvedValue(null);
  });

  it('recognizes public paths and callback prefixes', () => {
    expect(isPublicPath('/api/health')).toBe(true);
    expect(isPublicPath('/api/auth/callback/credentials')).toBe(true);
    expect(isPublicPath('/dashboard')).toBe(false);
  });

  it('redirects unauthenticated protected requests to login', async () => {
    const response = await middleware(request('/dashboard'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?redirectTo=%2Fdashboard');
  });

  it('allows public requests without a token', async () => {
    const response = await middleware(request('/api/health'));
    expect(response.status).toBe(200);
  });

  it('redirects authenticated login requests to dashboard', async () => {
    mockGetToken.mockResolvedValue({ sub: 'user-1' } as never);
    const response = await middleware(request('/login'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/dashboard');
  });
});
