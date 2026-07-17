import { invokeAgentWithEnv, type AgentEnv } from '../agent-invoker';

function makeEnv() {
  const calls: Record<string, unknown> = {};
  const env: AgentEnv = {
    IA_BRIDGE: {
      issueHandle: async (i: { conversationId: string; clinicId: string; principalRef: string; source: string }) => {
        calls.issue = i;
        return { handle: 'H' };
      },
    } as unknown as AgentEnv['IA_BRIDGE'],
    AGENT: {
      idFromName: (name: string) => {
        calls.idName = name;
        return { name };
      },
      get: (_id: unknown) => ({
        runTurn: async (i: { handle: string }) => {
          calls.runTurn = i;
          return { reply: 'oi', turnsUsed: 1 };
        },
      }),
    } as unknown as AgentEnv['AGENT'],
  };
  return { env, calls };
}

describe('invokeAgentWithEnv', () => {
  it('issues handle, addresses DO by conversation, runs turn', async () => {
    const { env, calls } = makeEnv();
    const out = await invokeAgentWithEnv(env, {
      clinicId: 'c1',
      conversationId: 'conv-1',
      channel: 'whatsapp',
      peerId: '5511',
      principalRef: 'agente',
      source: 'system',
      personaType: 'paciente',
      context: 'Paciente: João',
      timezone: 'America/Sao_Paulo',
      userMessage: 'oi',
    });
    expect(out.reply).toBe('oi');
    expect((calls.issue as { conversationId: string }).conversationId).toBe('conv-1');
    expect(calls.idName).toBe('c1:whatsapp:conv-1');
    expect((calls.runTurn as { handle: string }).handle).toBe('H');
  });

  it('passes confirmedToken and identityVerifiedToken when provided', async () => {
    const { env, calls } = makeEnv();
    await invokeAgentWithEnv(env, {
      clinicId: 'c1',
      conversationId: 'conv-2',
      channel: 'chat',
      peerId: 'u1',
      principalRef: 'u1',
      source: 'agent_delegated',
      personaType: 'funcionario',
      context: '',
      timezone: 'America/Sao_Paulo',
      userMessage: 'sim, confirmo',
      confirmedToken: 'tok-confirm',
      identityVerifiedToken: 'tok-identity',
    });
    expect((calls.runTurn as { confirmedToken: string }).confirmedToken).toBe('tok-confirm');
    expect((calls.runTurn as { identityVerifiedToken: string }).identityVerifiedToken).toBe('tok-identity');
  });
});

describe('invokeAgentWithEnv — robustez (anti-hang / worker-cancel)', () => {
  // Regressão do smoke: o DO ia-agent pode falhar de várias formas
  // (PartyServer name não setado em cross-worker RPC, bootstrap lazy, etc).
  // invokeAgentWithEnv NUNCA pode deixar o erro subir — quem chama é uma
  // rota HTTP e o caller não pode sofrer cancelamento de Worker.
  // O contrato é: retornar um RunTurnResult com reply de fallback.

  const baseInput: Parameters<typeof invokeAgentWithEnv>[1] = {
    clinicId: 'c1',
    conversationId: 'conv-x',
    channel: 'chat',
    peerId: 'u1',
    principalRef: 'u1',
    source: 'agent_delegated',
    personaType: 'funcionario',
    context: '',
    timezone: 'America/Sao_Paulo',
    userMessage: 'oi',
  };

  it('returns fallback when runTurn throws (DO bootstrap / PartyServer name)', async () => {
    const env: AgentEnv = {
      IA_BRIDGE: { issueHandle: async () => ({ handle: 'H' }) } as AgentEnv['IA_BRIDGE'],
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({
          runTurn: async () => {
            throw new Error('Attempting to read .name on AgentOrchestrator …');
          },
        }),
      },
    } as unknown as AgentEnv;
    const out = await invokeAgentWithEnv(env, baseInput);
    expect(out.reply).toBeTruthy();
    expect(typeof out.reply).toBe('string');
    expect(out.turnsUsed).toBe(0);
    // sem flag escalated explícita; usuário recebe fallback neutro
    expect(out.escalated).toBeUndefined();
  });

  it('returns fallback when issueHandle throws (ia-bridge indisponível)', async () => {
    const env: AgentEnv = {
      IA_BRIDGE: { issueHandle: async () => { throw new Error('HMAC: bad secret'); } } as AgentEnv['IA_BRIDGE'],
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({ runTurn: async () => ({ reply: 'should not reach', turnsUsed: 1 }) }),
      },
    } as unknown as AgentEnv;
    const out = await invokeAgentWithEnv(env, baseInput);
    expect(out.reply).toBeTruthy();
    expect(out.turnsUsed).toBe(0);
  });

  it('returns fallback when idFromName throws (binding ausente)', async () => {
    const env: AgentEnv = {
      IA_BRIDGE: { issueHandle: async () => ({ handle: 'H' }) } as AgentEnv['IA_BRIDGE'],
      AGENT: {
        idFromName: () => { throw new Error('AGENT binding missing'); },
        get: () => ({ runTurn: async () => ({ reply: 'should not reach', turnsUsed: 1 }) }),
      },
    } as unknown as AgentEnv;
    const out = await invokeAgentWithEnv(env, baseInput);
    expect(out.reply).toBeTruthy();
    expect(out.turnsUsed).toBe(0);
  });

  it('returns fallback when stub.runTurn never resolves (DO hang — anti-worker-cancel)', async () => {
    const env: AgentEnv = {
      IA_BRIDGE: { issueHandle: async () => ({ handle: 'H' }) } as AgentEnv['IA_BRIDGE'],
      AGENT: {
        idFromName: () => ({ name: 'x' }),
        get: () => ({
          // Promise que nunca resolve — simula o DO travado no PartyServer
          // (ctx.id.name not set) que vimos no smoke.
          runTurn: () => new Promise(() => {}),
        }),
      },
    } as unknown as AgentEnv;
    const out = await invokeAgentWithEnv(env, baseInput, { timeoutMs: 200 });
    expect(out.reply).toBeTruthy();
    expect(typeof out.reply).toBe('string');
    expect(out.turnsUsed).toBe(0);
  });
});
