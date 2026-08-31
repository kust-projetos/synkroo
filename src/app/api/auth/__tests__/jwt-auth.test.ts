import { NextRequest } from 'next/server';
import { POST as legacyLogin } from '../login/route';
import { POST as legacyLogout } from '../logout/route';
import { authOptions } from '@/lib/auth/auth';
import { findUserProfileById } from '@/repositories/auth';

jest.mock('@/repositories/auth', () => ({
  findUserProfileById: jest.fn(),
  revokeUserSession: jest.fn(),
}));

const mockFindUserProfileById = findUserProfileById as jest.MockedFunction<typeof findUserProfileById>;

describe('canonical Auth.js session boundary', () => {
  beforeEach(() => jest.clearAllMocks());

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

  it('accepts a clinic update only when the user has explicit access', async () => {
    mockFindUserProfileById.mockResolvedValue({
      id: 'user-1',
      email: 'u@test.local',
      name: 'User',
      role: 'receptionist',
      roleId: 'role-b',
      roleName: 'receptionist',
      phone: null,
      avatarUrl: null,
      isActive: true,
      sessionVersion: 3,
      clinicId: 'clinic-b',
      clinics: null,
    });

    const callback = authOptions.callbacks?.jwt;
    const token = await callback!({
      token: { id: 'user-1', clinicId: 'clinic-a', sessionVersion: 3 },
      trigger: 'update',
      session: { user: { clinicId: 'clinic-b' } },
    } as never);

    expect(token.clinicId).toBe('clinic-b');
  });

  it('does not accept a forged clinic update', async () => {
    mockFindUserProfileById.mockResolvedValue(null);

    const callback = authOptions.callbacks?.jwt;
    const token = await callback!({
      token: { id: 'user-1', clinicId: 'clinic-a', sessionVersion: 3 },
      trigger: 'update',
      session: { user: { clinicId: 'clinic-b' } },
    } as never);

    expect(token.clinicId).toBe('clinic-a');
  });
});
