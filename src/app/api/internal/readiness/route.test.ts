import { NextRequest } from 'next/server';
import { GET } from './route';
import { getSession } from '@/lib/auth/session';

jest.mock('@/lib/auth/session', () => ({ getSession: jest.fn() }));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

describe('GET /api/internal/readiness', () => {
  it('rejects unauthenticated readiness probes', async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/internal/readiness'));

    expect(response.status).toBe(401);
  });

  it('returns a privacy-safe readiness result for an authenticated session', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-1' } } as never);

    const response = await GET(new NextRequest('http://localhost/api/internal/readiness'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready' });
  });
});
