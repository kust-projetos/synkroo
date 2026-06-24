/**
 * Integration test: chat API route → route-adapter → orchestrator.
 * Tests the full chat flow with mocked dependencies.
 */
import { handleChatRequest } from '@/modules/ia/ui/route-adapter';

// ── Mocks (jest.mock is hoisted — use closures to share mocks) ─

jest.mock('@/modules/ia/agent/orchestrator', () => ({
  runOrchestratorLoop: jest.fn(),
}));

jest.mock('@/modules/ia/agent/interlocutor', () => {
  const mockResolver = { resolve: jest.fn() };
  return {
    createInterlocutorResolver: jest.fn(() => mockResolver),
  };
});

jest.mock('@/modules/ia/llm/provider', () => ({
  createLlmProvider: jest.fn(() => ({ complete: jest.fn() })),
}));

jest.mock('@/core/actions/context', () => ({
  buildDelegatedContext: jest.fn(),
  buildUserContext: jest.fn(),
  buildSystemContext: jest.fn(),
}));

const orchestratorM = jest.mocked(require('@/modules/ia/agent/orchestrator'));
const interlocutorM = jest.mocked(require('@/modules/ia/agent/interlocutor'));
const contextM = jest.mocked(require('@/core/actions/context'));

function getRunLoopMock(): jest.Mock {
  return orchestratorM.runOrchestratorLoop as jest.Mock;
}

function getResolveMock(): jest.Mock {
  return interlocutorM.createInterlocutorResolver().resolve as jest.Mock;
}

function getBuildDelegatedMock(): jest.Mock {
  return contextM.buildDelegatedContext as jest.Mock;
}

// ── Tests ────────────────────────────────────────────────────

describe('Chat API integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns agent response for authenticated chat message', async () => {
    getBuildDelegatedMock().mockResolvedValue({
      source: 'agent_delegated',
      clinicId: 'clinic-1',
      user: { id: 'user-1', email: '', name: '' },
      role: 'admin',
      can: jest.fn().mockReturnValue(true),
      hasModule: jest.fn().mockReturnValue(true),
      audit: { actor: 'agente', onBehalfOf: 'user-1' },
    });
    getResolveMock().mockResolvedValue({
      kind: 'funcionario',
      personaType: 'gestao',
      context: { userId: 'user-1' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'Aqui está o relatório de agendamentos de hoje.',
      state: { personaType: 'gestao', history: [], turnCount: 2 },
    });

    const response = await handleChatRequest('user-1', 'clinic-1', 'Relatório de hoje');

    const body = await response.json();
    expect(body.response).toContain('relatório');
    expect(body.turnCount).toBe(2);
    expect(response.status).toBe(200);
  });

  it('returns 401 when buildDelegatedContext throws (no RBAC)', async () => {
    getBuildDelegatedMock().mockRejectedValue(new Error('unauthenticated'));

    const response = await handleChatRequest('bad-user', 'clinic-1', 'Oi');

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when message is empty', async () => {
    const response = await handleChatRequest('user-1', 'clinic-1', '');

    expect(response.status).toBe(400);
  });

  it('passes correct parameters to orchestrator loop', async () => {
    const ctx = {
      source: 'agent_delegated' as const,
      clinicId: 'clinic-x',
      user: { id: 'user-1', email: '', name: '' },
      role: 'admin',
      can: jest.fn().mockReturnValue(true),
      hasModule: jest.fn().mockReturnValue(true),
      audit: { actor: 'agente', onBehalfOf: 'user-1' },
    };
    getBuildDelegatedMock().mockResolvedValue(ctx);
    getResolveMock().mockResolvedValue({
      kind: 'funcionario',
      personaType: 'gestao',
      context: { userId: 'user-1' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'OK',
      state: { personaType: 'gestao', history: [], turnCount: 1 },
    });

    await handleChatRequest('user-1', 'clinic-x', 'Mensagem de teste');

    expect(getBuildDelegatedMock()).toHaveBeenCalledWith('user-1', 'clinic-x');
    expect(getRunLoopMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Mensagem de teste',
        context: ctx,
        state: expect.objectContaining({
          personaType: 'gestao',
          history: [],
          turnCount: 0,
        }),
      }),
      expect.objectContaining({
        provider: expect.any(Object),
      }),
    );
  });
});
