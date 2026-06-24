/**
 * Integration test: WhatsApp inbound → interlocutor + orchestrator.
 * Mocks external dependencies (DB, LLM) — validates wiring, not runtime I/O.
 */
import { handleWhatsAppInbound } from '@/modules/ia/channel/inbound';
import type { ActionContext } from '@/core/actions/types';

// ── Mocks (jest.mock is hoisted — use closures to share mocks) ─

jest.mock('@/modules/ia/agent/interlocutor', () => {
  const mockResolver = { resolve: jest.fn() };
  return {
    createInterlocutorResolver: jest.fn(() => mockResolver),
  };
});

jest.mock('@/modules/ia/agent/orchestrator', () => ({
  runOrchestratorLoop: jest.fn(),
}));

jest.mock('@/modules/ia/llm/provider', () => ({
  createLlmProvider: jest.fn(() => ({ complete: jest.fn() })),
}));

const interlocutorM = jest.mocked(require('@/modules/ia/agent/interlocutor'));
const orchestratorM = jest.mocked(require('@/modules/ia/agent/orchestrator'));

function getResolveMock(): jest.Mock {
  return interlocutorM.createInterlocutorResolver().resolve as jest.Mock;
}

function getRunLoopMock(): jest.Mock {
  return orchestratorM.runOrchestratorLoop as jest.Mock;
}

// ── Helpers ──────────────────────────────────────────────────

function makeCtx(clinicId = 'clinic-1'): ActionContext {
  return {
    source: 'system',
    clinicId,
    can: jest.fn().mockReturnValue(true),
    hasModule: jest.fn().mockReturnValue(true),
    audit: { actor: 'agente (sistema)' },
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('WhatsApp inbound integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes known patient → relacionamento persona + response', async () => {
    getResolveMock().mockResolvedValue({
      kind: 'paciente',
      personaType: 'relacionamento',
      context: { patientId: 'pat-001', phone: '+5511988887777' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'Sua consulta está confirmada para amanhã às 14h.',
      state: { personaType: 'relacionamento', history: [], turnCount: 2 },
    });

    const result = await handleWhatsAppInbound(
      {
        externalMessageId: 'w1',
        phone: '+5511988887777',
        clinicId: 'clinic-1',
        body: 'Minha consulta está confirmada?',
      },
      makeCtx(),
    );

    expect(result.interlocutorKind).toBe('paciente');
    expect(result.response).toContain('confirmada');
    expect(result.turnCount).toBe(2);
  });

  it('routes unknown number → recepcao persona + response', async () => {
    getResolveMock().mockResolvedValue({
      kind: 'desconhecido',
      personaType: 'recepcao',
      context: { phone: '+5511966665555' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'Bem-vindo à clínica! Como posso ajudar?',
      state: { personaType: 'recepcao', history: [], turnCount: 1 },
    });

    const result = await handleWhatsAppInbound(
      {
        externalMessageId: 'w2',
        phone: '+5511966665555',
        clinicId: 'clinic-1',
        body: 'Olá',
      },
      makeCtx(),
    );

    expect(result.interlocutorKind).toBe('desconhecido');
    expect(result.response).toContain('Bem-vindo');
  });
});
