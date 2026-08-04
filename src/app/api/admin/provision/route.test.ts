import { NextRequest } from 'next/server';
import { POST } from './route';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn() }));

it('is unavailable to clinical application tokens', async () => {
  const response = await POST(new NextRequest('http://localhost/api/admin/provision', { method: 'POST' }));

  expect(response.status).toBe(404);
});
