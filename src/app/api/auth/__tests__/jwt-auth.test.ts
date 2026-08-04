import { NextRequest } from 'next/server';
import { POST as legacyLogin } from '../login/route';
import { POST as legacyLogout } from '../logout/route';
import { authOptions } from '@/lib/auth/auth';

describe('canonical Auth.js session boundary', () => {
  it('does not expose a parallel login endpoint', async () => {
    const response = await legacyLogin(new NextRequest('http://localhost/api/auth/login', { method: 'POST' }));
    expect(response.status).toBe(404);
  });

  it('does not expose a parallel logout endpoint', async () => {
    const response = await legacyLogout(new Request('http://localhost/api/auth/logout', { method: 'POST' }));
    expect(response.status).toBe(404);
  });

  it('uses credentials provider and JWT sessions through NextAuth', () => {
    expect(authOptions.session?.strategy).toBe('jwt');
    expect(authOptions.providers).toHaveLength(1);
  });
});
