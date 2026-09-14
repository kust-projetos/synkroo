const mockInvoke = jest.fn();
jest.mock('@/core/ia-channel/agent-invoker', () => ({ invokeAgent: (...a: unknown[]) => mockInvoke(...a) }));
const mockBuildCtx = jest.fn();
jest.mock('@/core/actions/context', () => ({ buildUserContext: () => mockBuildCtx() }));
jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (h: unknown) => h }));
jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));

import { NextRequest } from 'next/server';
import { POST, toPublicChatDto } from '../chat/route';
import { resolveIaTimezone } from '../timezone';

function req(body: unknown) {
  return new Request('http://localhost/api/ia/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }) as unknown as NextRequest;
}

const ctxWith =
  (can: (k: string) => boolean) =>
  ({ user: { id: 'u1', name: 'Ana' }, clinicId: 'c1', can });

describe('POST /api/ia/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildCtx.mockResolvedValue(ctxWith((k) => k === 'ia:chat'));
  });

  it('delegates to invokeAgent with funcionario persona and returns reply', async () => {
    mockInvoke.mockResolvedValue({ reply: 'Olá Ana!', turnsUsed: 1 });
    const res = await POST(req({ conversationId: 'conv-1', message: 'oi' }));
    expect(res.status).toBe(200);
    expect((await res.json()).reply).toBe('Olá Ana!');
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'agent_delegated',
        personaType: 'funcionario',
        channel: 'chat',
        principalRef: 'u1',
      }),
    );
  });

  it('401 when unauthenticated', async () => {
    mockBuildCtx.mockRejectedValueOnce(new Error('unauthenticated'));
    expect((await POST(req({ conversationId: 'conv-1', message: 'oi' }))).status).toBe(401);
  });

  it('403 when missing ia:chat permission', async () => {
    mockBuildCtx.mockResolvedValueOnce(ctxWith(() => false));
    expect((await POST(req({ conversationId: 'conv-1', message: 'oi' }))).status).toBe(403);
  });

  it('422 when payload missing fields', async () => {
    mockBuildCtx.mockResolvedValueOnce(ctxWith((k) => k === 'ia:chat'));
    const res = await POST(req({}));
    expect(res.status).toBe(422);
  });

  it('500 when invokeAgent throws (hardening)', async () => {
    mockBuildCtx.mockResolvedValueOnce(ctxWith((k) => k === 'ia:chat'));
    mockInvoke.mockRejectedValueOnce(new Error('bridge RPC failed'));
    const res = await POST(req({ conversationId: 'conv-1', message: 'oi' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error', turnsUsed: 0 });
  });
  it('resolves configured timezone and falls back safely', () => {
    expect(resolveIaTimezone('Europe/Lisbon')).toBe('Europe/Lisbon');
    expect(resolveIaTimezone(undefined)).toBe('America/Sao_Paulo');
  });

  it('public DTO omite errorCode interno e preserva estado (B2)', () => {
    expect(
      toPublicChatDto({ reply: 'x', turnsUsed: 1, errorCode: 'forbidden' }),
    ).toEqual({ reply: 'x', turnsUsed: 1 });
    expect(
      toPublicChatDto({
        reply: 'y',
        turnsUsed: 0,
        escalated: true,
        escalationReason: 'action_escalate_human',
        errorCode: 'rpc_timeout',
      }),
    ).toEqual({
      reply: 'y',
      turnsUsed: 0,
      escalated: true,
      escalationReason: 'action_escalate_human',
      errorCode: 'rpc_timeout',
    });
  });

  it('echoes inbound x-request-id and propagates it as correlationId (B2)', async () => {
    mockInvoke.mockResolvedValue({ reply: 'ok', turnsUsed: 1 });
    const r = new Request('http://localhost/api/ia/chat', {
      method: 'POST',
      body: JSON.stringify({ conversationId: 'conv-1', message: 'oi' }),
      headers: { 'Content-Type': 'application/json', 'x-request-id': 'req-abc' },
    }) as unknown as NextRequest;
    const res = await POST(r);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBe('req-abc');
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: 'req-abc' }),
    );
  });

  it('generates x-request-id when the caller sends none (B2)', async () => {
    mockInvoke.mockResolvedValue({ reply: 'ok', turnsUsed: 1 });
    const res = await POST(req({ conversationId: 'conv-1', message: 'oi' }));
    const echoed = res.headers.get('x-request-id');
    expect(typeof echoed).toBe('string');
    expect(echoed!.length).toBeGreaterThan(0);
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({ correlationId: echoed }),
    );
  });
});
