import { NextRequest } from 'next/server';
import { POST } from './route';
import { requireActiveProfile } from '@/lib/auth/session';

const limit = jest.fn();

jest.mock('@/lib/auth/session', () => ({ requireActiveProfile: jest.fn() }));
jest.mock('@/lib/db/client', () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
  }),
}));

const mockRequireActiveProfile = requireActiveProfile as jest.MockedFunction<typeof requireActiveProfile>;

const activeProfile = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  role: 'owner',
  phone: null,
  avatar_url: null,
  is_active: true,
  session_version: 3,
  clinic_id: 'clinic-a',
  clinics: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireActiveProfile.mockResolvedValue(activeProfile);
  limit.mockResolvedValue([{ roleId: 'owner-role' }]);
});

test('validates access without issuing a parallel JWT cookie', async () => {
  const targetClinicId = '00000000-0000-0000-0000-000000000002';
  const request = new NextRequest('http://localhost/api/auth/switch-clinic', {
    method: 'POST',
    body: JSON.stringify({ clinicId: targetClinicId }),
  });
  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(mockRequireActiveProfile).toHaveBeenCalledTimes(1);
});

test('rejects revoked sessions before checking clinic access', async () => {
  mockRequireActiveProfile.mockRejectedValue(new Error('Unauthorized'));
  const request = new NextRequest('http://localhost/api/auth/switch-clinic', {
    method: 'POST',
    body: JSON.stringify({ clinicId: '00000000-0000-0000-0000-000000000002' }),
  });

  const response = await POST(request);

  expect(response.status).toBe(401);
  expect(limit).not.toHaveBeenCalled();
});
