import { handleWhatsAppInbound } from '../inbound';
import type { InboundMessage, InboundResult } from '../inbound';
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

jest.mock('@/modules/ia/llm/provider', () => {
  const mockProvider = { complete: jest.fn() };
  return {
    createLlmProvider: jest.fn(() => mockProvider),
  };
});

const interlocutorM = jest.mocked(require('@/modules/ia/agent/interlocutor'));
const orchestratorM = jest.mocked(require('@/modules/ia/agent/orchestrator'));

function getResolveMock(): jest.Mock {
  return interlocutorM.createInterlocutorResolver().resolve as jest.Mock;
}

function getRunLoopMock(): jest.Mock {
  return orchestratorM.runOrchestratorLoop as jest.Mock;
}

// ── Helpers ──────────────────────────────────────────────────

function makeContext(overrides?: Partial<ActionContext>): ActionContext {
  return {
    source: 'system',
    clinicId: 'clinic-1',
    can: jest.fn().mockReturnValue(true),
    hasModule: jest.fn().mockReturnValue(true),
    audit: { actor: 'agente (sistema)' },
    ...overrides,
  };
}

function makeMessage(overrides?: Partial<InboundMessage>): InboundMessage {
  return {
    externalMessageId: 'msg-001',
    phone: '+5511999998888',
    clinicId: 'clinic-1',
    body: 'Olá, gostaria de agendar uma consulta',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('handleWhatsAppInbound', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves interlocutor with phone and clinicId', async () => {
    getResolveMock().mockResolvedValue({
      kind: 'paciente',
      personaType: 'relacionamento',
      context: { patientId: 'p1', phone: '+5511999998888' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'Consulta agendada para quinta!',
      state: { personaType: 'relacionamento', history: [], turnCount: 2 },
    });

    const result = await handleWhatsAppInbound(makeMessage(), makeContext());

    expect(getResolveMock()).toHaveBeenCalledWith({
      phone: '+5511999998888',
      clinicId: 'clinic-1',
    });
    expect(result.interlocutorKind).toBe('paciente');
  });

  it('passes correct parameters to orchestrator loop', async () => {
    getResolveMock().mockResolvedValue({
      kind: 'paciente',
      personaType: 'relacionamento',
      context: { patientId: 'p1', phone: '+5511999998888' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'Resposta',
      state: { personaType: 'relacionamento', history: [], turnCount: 1 },
    });

    const ctx = makeContext();
    const msg = makeMessage({ body: 'Gostaria de confirmar meu horário' });

    await handleWhatsAppInbound(msg, ctx);

    expect(getRunLoopMock()).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Gostaria de confirmar meu horário',
        context: ctx,
        state: expect.objectContaining({
          personaType: 'relacionamento',
          history: [],
          turnCount: 0,
        }),
      }),
      expect.objectContaining({
        provider: expect.any(Object),
        maxTurns: 10,
      }),
    );
  });

  it('returns response, interlocutorKind, and turnCount', async () => {
    getResolveMock().mockResolvedValue({
      kind: 'lead',
      personaType: 'vendas',
      context: { leadId: 'l1', phone: '+5511999998888' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'Temos uma avaliação gratuita disponível!',
      state: { personaType: 'vendas', history: [], turnCount: 3 },
    });

    const result: InboundResult = await handleWhatsAppInbound(
      makeMessage(),
      makeContext(),
    );

    expect(result).toEqual({
      response: 'Temos uma avaliação gratuita disponível!',
      interlocutorKind: 'lead',
      turnCount: 3,
    });
  });

  it('handles desconhecido with recepcao persona', async () => {
    getResolveMock().mockResolvedValue({
      kind: 'desconhecido',
      personaType: 'recepcao',
      context: { phone: '+5511977776666' },
    });
    getRunLoopMock().mockResolvedValue({
      response: 'Bem-vindo! Como posso ajudar?',
      state: { personaType: 'recepcao', history: [], turnCount: 1 },
    });

    const result = await handleWhatsAppInbound(
      makeMessage({ phone: '+5511977776666', body: 'Oi' }),
      makeContext(),
    );

    expect(result.interlocutorKind).toBe('desconhecido');
    expect(result.response).toContain('Bem-vindo');
  });
});
