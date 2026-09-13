import { NextRequest } from 'next/server';
import { POST, IA_CHAT_MAX_MESSAGE_LENGTH } from '../route';

jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (h: unknown) => h,
}));

jest.mock('@/core/actions/context', () => ({
  buildUserContext: jest.fn(),
}));

jest.mock('@/core/ia-channel/agent-invoker', () => ({
  invokeAgent: jest.fn(),
}));

jest.mock('@/core/ia-channel/interlocutor', () => ({
  resolveFuncionario: jest.fn(() => ({
    personaType: 'funcionario',
    context: 'ctx',
    peerId: 'u1',
  })),
}));

jest.mock('../../timezone', () => ({
  resolveIaTimezone: jest.fn(() => 'America/Sao_Paulo'),
}));

const { buildUserContext } = jest.requireMock('@/core/actions/context') as {
  buildUserContext: jest.Mock;
};
const { invokeAgent } = jest.requireMock('@/core/ia-channel/agent-invoker') as {
  invokeAgent: jest.Mock;
};

function authed() {
  buildUserContext.mockResolvedValue({
    user: { id: 'u1', name: 'Ana' },
    clinicId: 'c1',
    can: () => true,
  });
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/ia/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  authed();
  invokeAgent.mockResolvedValue({ reply: 'ok', turnsUsed: 1 });
});

describe('POST /api/ia/chat — cap de payload (B1)', () => {
  it('exporta o limite usado pelo gate', () => {
    expect(IA_CHAT_MAX_MESSAGE_LENGTH).toBe(4000);
  });

  it('mensagem oversize → 400 com envelope canônico, sem chamar o agente', async () => {
    const res = await POST(
      req({ conversationId: 'conv-1', message: 'x'.repeat(IA_CHAT_MAX_MESSAGE_LENGTH + 1) }, { 'x-request-id': 'req-cap-1' }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: expect.any(String),
        requestId: 'req-cap-1',
      },
    });
    expect(res.headers.get('x-request-id')).toBe('req-cap-1');
    expect(invokeAgent).not.toHaveBeenCalled();
  });

  it('mensagem no limite exato passa', async () => {
    const res = await POST(
      req({ conversationId: 'conv-1', message: 'x'.repeat(IA_CHAT_MAX_MESSAGE_LENGTH) }),
    );
    expect(res.status).toBe(200);
    expect(invokeAgent).toHaveBeenCalledTimes(1);
  });

  it('401 sem sessão e sem acionar o agente (tokens do body nunca lidos)', async () => {
    buildUserContext.mockRejectedValue(new Error('unauthenticated'));
    const res = await POST(
      req({ conversationId: 'conv-1', message: 'oi', confirmedToken: 'tok-atk' }),
    );
    expect(res.status).toBe(401);
    expect(invokeAgent).not.toHaveBeenCalled();
  });
});
