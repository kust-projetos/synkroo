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
