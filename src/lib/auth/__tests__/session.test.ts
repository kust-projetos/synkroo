import { getServerSession } from 'next-auth';
import { getSession, getCurrentUser } from '@/lib/auth/session';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;

describe('getSession / getCurrentUser (auth typing)', () => {
  beforeEach(() => {
    mockGetServerSession.mockReset();
  });

  it('getSession returns the session produced by getServerSession', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u1', email: 'e@x.com', name: 'Nurse' },
    });
    const session = await getSession();
    expect(session?.user.id).toBe('u1');
    expect(session?.user.email).toBe('e@x.com');
    expect(session?.user.name).toBe('Nurse');
  });

  it('getSession returns null when getServerSession resolves null', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const session = await getSession();
    expect(session).toBeNull();
  });

  it('getCurrentUser extracts id/email/name', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'u1', email: 'e@x.com', name: 'Nurse' },
    });
    const user = await getCurrentUser();
    expect(user).toMatchObject({ id: 'u1', email: 'e@x.com', name: 'Nurse' });
  });

  it('getCurrentUser returns null when session user has no id', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: '', email: '', name: '' },
    });
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

// Type-contract guard: getSession() must return a Session whose user.id is a
// string. If the auth typing regresses to `{}`, this fails to compile (tsc red).
async function __typeContract() {
  const s = await getSession();
  if (s) {
    const id: string = s.user.id;
    void id;
  }
}
void __typeContract;
