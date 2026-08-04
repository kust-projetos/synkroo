import { NextRequest } from 'next/server';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as logout } from '@/app/api/auth/logout/route';

describe('legacy auth endpoints', () => {
  it('returns 404 for manual login', async () => {
    const response = await login(new NextRequest('http://localhost/api/auth/login', { method: 'POST' }));
    expect(response.status).toBe(404);
  });

  it('returns 404 for manual logout', async () => {
    const response = await logout(new Request('http://localhost/api/auth/logout', { method: 'POST' }));
    expect(response.status).toBe(404);
  });
});
