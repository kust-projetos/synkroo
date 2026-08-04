import { getServerSession } from 'next-auth';
import { findUserProfileById } from '@/repositories/auth';
import { isAuthenticated, requireActiveProfile } from '../session';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/repositories/auth', () => ({ findUserProfileById: jest.fn() }));

const session = getServerSession as jest.Mock;
const profile = findUserProfileById as jest.Mock;

describe('server session revocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    session.mockResolvedValue({ user: { id: 'u1', sessionVersion: 3 } });
  });

  it.each([
    ['inactive', { isActive: false, sessionVersion: 3 }],
    ['stale', { isActive: true, sessionVersion: 4 }],
  ])('rejects %s profile', async (_name, row) => {
    profile.mockResolvedValue({
      id: 'u1', email: 'u@test.local', name: 'User', role: 'owner', phone: null,
      avatarUrl: null, clinicId: 'c1', clinics: null, ...row,
    });

    await expect(requireActiveProfile()).rejects.toThrow('Unauthorized');
  });

  it('does not treat a revoked session as authenticated', async () => {
    profile.mockResolvedValue({
      id: 'u1', email: 'u@test.local', name: 'User', role: 'owner', phone: null,
      avatarUrl: null, clinicId: 'c1', clinics: null, isActive: false, sessionVersion: 3,
    });

    await expect(isAuthenticated()).resolves.toBe(false);
  });
});
