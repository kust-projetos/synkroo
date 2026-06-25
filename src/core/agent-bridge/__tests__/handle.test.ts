import { issueHandle, verifyHandle } from '../handle';

const SECRET = 'test-secret-do-not-use-in-prod';

function memStore() {
  const seen = new Set<string>();
  return {
    async wasSeen(jti: string) {
      return seen.has(jti);
    },
    async markSeen(jti: string, _ttlSeconds: number) {
      seen.add(jti);
    },
  };
}

describe('handle', () => {
  const base = {
    clinicId: 'c1',
    conversationId: 'conv-1',
    principalRef: 'u1',
    source: 'agent_delegated' as const,
  };

  it('issues and verifies a valid handle', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const r = await verifyHandle(SECRET, handle, {
      conversationId: 'conv-1',
      store: memStore(),
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.clinicId).toBe('c1');
  });

  it('rejects forged signature', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const r = await verifyHandle(SECRET, `${handle}x`, {
      conversationId: 'conv-1',
      store: memStore(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_signature');
  });

  it('rejects expired handle', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: -1 });
    const r = await verifyHandle(SECRET, handle, {
      conversationId: 'conv-1',
      store: memStore(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('expired');
  });

  it('rejects cross-conversation reuse', async () => {
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const r = await verifyHandle(SECRET, handle, {
      conversationId: 'OTHER',
      store: memStore(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('conversation_mismatch');
  });

  it('rejects replay (same jti twice) when singleUse', async () => {
    const store = memStore();
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const first = await verifyHandle(SECRET, handle, {
      conversationId: 'conv-1',
      store,
      singleUse: true,
    });
    const second = await verifyHandle(SECRET, handle, {
      conversationId: 'conv-1',
      store,
      singleUse: true,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('replayed');
  });

  it('allows reuse when singleUse is false', async () => {
    const store = memStore();
    const { handle } = await issueHandle(SECRET, { ...base, ttlSeconds: 60 });
    const first = await verifyHandle(SECRET, handle, {
      conversationId: 'conv-1',
      store,
      singleUse: false,
    });
    const second = await verifyHandle(SECRET, handle, {
      conversationId: 'conv-1',
      store,
      singleUse: false,
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it('rejects malformed handle', async () => {
    const r = await verifyHandle(SECRET, 'not-a-valid-handle', {
      conversationId: 'conv-1',
      store: memStore(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('malformed');
  });
});
