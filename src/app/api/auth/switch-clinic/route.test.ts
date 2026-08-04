import { NextRequest } from 'next/server';
import { POST } from './route';

const limit = jest.fn();

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn(), encode: jest.fn() }));
import { getToken } from 'next-auth/jwt';
jest.mock('@/lib/db/client', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
  }),
}));

it('validates access without issuing a parallel JWT cookie', async () => {
  process.env.AUTH_SECRET = 'x'.repeat(32);
  (getToken as jest.Mock).mockResolvedValue({ id: 'user-1', clinicId: 'clinic-a' });
  limit.mockResolvedValue([{ roleId: 'owner' }]);

  const request = new NextRequest('http://localhost/api/auth/switch-clinic', {
    method: 'POST',
    body: JSON.stringify({ clinicId: '00000000-0000-0000-0000-000000000002' }),
  });
  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toBeNull();
});
