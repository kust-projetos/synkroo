import { routeInboundToAgent } from '../webhook-router';

it('resolves interlocutor, invokes agent (system, conv.id), sends reply', async () => {
  const calls: Record<string, unknown> = {};
  const result = await routeInboundToAgent(
    {
      resolveInterlocutor: async () => ({
        personaType: 'paciente' as const,
        context: 'Paciente: João',
        peerId: '5511',
      }),
      invokeAgent: async (i) => {
        calls.invoke = i;
        return { reply: 'Agendado!', turnsUsed: 2 };
      },
      sendReply: async (convId, msg) => {
        calls.sent = { convId, msg };
        return true;
      },
      timezone: 'America/Sao_Paulo',
    },
    { clinicId: 'c1', conversationId: 'conv-uuid', phone: '5511', content: 'quero agendar' },
  );

  expect((calls.invoke as { source: string }).source).toBe('system');
  expect((calls.invoke as { conversationId: string }).conversationId).toBe('conv-uuid');
  expect((calls.invoke as { personaType: string }).personaType).toBe('paciente');
  expect(calls.sent).toEqual({ convId: 'conv-uuid', msg: 'Agendado!' });
  expect(result.action).toBe('agent_replied');
});

it('returns send_failed when sendReply fails (runAction not ok)', async () => {
  const result = await routeInboundToAgent(
    {
      resolveInterlocutor: async () => ({
        personaType: 'recepcao' as const,
        context: '',
        peerId: '5511',
      }),
      invokeAgent: async () => ({ reply: 'oi', turnsUsed: 1 }),
      sendReply: async () => false,
      timezone: 'America/Sao_Paulo',
    },
    { clinicId: 'c1', conversationId: 'conv-uuid', phone: '5511', content: 'oi' },
  );
  expect(result.action).toBe('send_failed');
});

it('sends escalation reply before returning escalated', async () => {
  const calls: Record<string, unknown> = {};
  const result = await routeInboundToAgent(
    {
      resolveInterlocutor: async () => ({
        personaType: 'recepcao' as const,
        context: '',
        peerId: '5511',
      }),
      invokeAgent: async () => ({
        reply: 'Vou encaminhar para um humano.',
        turnsUsed: 1,
        escalated: true,
      }),
      sendReply: async (convId, msg) => {
        calls.sent = { convId, msg };
        return true;
      },
      timezone: 'America/Sao_Paulo',
    },
    {
      clinicId: 'c1',
      conversationId: 'conv-uuid',
      phone: '5511',
      content: 'preciso de ajuda',
    },
  );
  expect(calls.sent).toEqual({
    convId: 'conv-uuid',
    msg: 'Vou encaminhar para um humano.',
  });
  expect(result.action).toBe('escalated');
});

it('returns no_reply when agent returns empty reply', async () => {
  const result = await routeInboundToAgent(
    {
      resolveInterlocutor: async () => ({
        personaType: 'recepcao' as const,
        context: '',
        peerId: '5511',
      }),
      invokeAgent: async () => ({ reply: '', turnsUsed: 0 }),
      sendReply: async () => true,
      timezone: 'America/Sao_Paulo',
    },
    { clinicId: 'c1', conversationId: 'conv-uuid', phone: '5511', content: 'ok' },
  );
  expect(result.action).toBe('no_reply');
});
