import { scryptSync, randomBytes } from 'node:crypto';
import { authOptions } from '../auth';
import { getDb } from '@/lib/db/client';
import { findUserProfileById, updateUserPasswordHash } from '@/repositories/auth';

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/repositories/auth', () => ({
  findUserProfileById: jest.fn(),
  revokeUserSession: jest.fn().mockResolvedValue(undefined),
  updateUserPasswordHash: jest.fn(),
}));

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockFindUserProfileById = findUserProfileById as jest.MockedFunction<
  typeof findUserProfileById
>;
const mockUpdateUserPasswordHash = updateUserPasswordHash as jest.MockedFunction<
  typeof updateUserPasswordHash
>;

/** Real legacy fixture in the exact old "salt:hash" shape. */
function legacyFixture(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const profile = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  clinicId: 'clinic-1',
  role: 'owner',
  roleId: 'role-1',
  isActive: true,
  sessionVersion: 0,
};

function mockLoginRows(passwordHash: string) {
  const limit = jest.fn().mockResolvedValue([
    { user: { id: 'user-1', clinicId: 'clinic-1' }, passwordHash },
  ]);
  const where = jest.fn().mockReturnValue({ limit });
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  const select = jest.fn().mockReturnValue({ from });
  mockGetDb.mockReturnValue({ select } as never);
}

async function authorize(email: string, password: string) {
  const provider = authOptions.providers[0] as unknown as {
    options: { authorize: (credentials: Record<string, string>) => Promise<unknown> };
  };
  return provider.options.authorize({ email, password });
}

describe('authorize transparent re-hash', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUserProfileById.mockResolvedValue(profile as never);
  });

  it('logs in when the CAS re-hash affects 0 rows, threading the verified hash', async () => {
    const legacyHash = legacyFixture('login-secret');
    mockLoginRows(legacyHash);
    mockUpdateUserPasswordHash.mockResolvedValue(false);

    const result = await authorize('user@example.com', 'login-secret');

    expect(result).toMatchObject({ id: 'user-1', clinicId: 'clinic-1' });
    expect(mockUpdateUserPasswordHash).toHaveBeenCalledTimes(1);
    const [userId, nextHash, expectedHash] = mockUpdateUserPasswordHash.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(nextHash).toMatch(/^scrypt\$v1\$16384\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(expectedHash).toBe(legacyHash);
  });

  it('logs in when the CAS re-hash succeeds', async () => {
    const legacyHash = legacyFixture('login-secret');
    mockLoginRows(legacyHash);
    mockUpdateUserPasswordHash.mockResolvedValue(true);

    const result = await authorize('user@example.com', 'login-secret');

    expect(result).toMatchObject({ id: 'user-1' });
    expect(mockUpdateUserPasswordHash).toHaveBeenCalledWith(
      'user-1',
      expect.stringMatching(/^scrypt\$v1\$/),
      legacyHash,
    );
  });

  it('skips the re-hash write for hashes already in v1 format', async () => {
    const { hashPassword } = await import('../password');
    mockLoginRows(await hashPassword('v1-secret'));

    const result = await authorize('user@example.com', 'v1-secret');

    expect(result).toMatchObject({ id: 'user-1' });
    expect(mockUpdateUserPasswordHash).not.toHaveBeenCalled();
  });
});
