import { runTurn } from '../orchestrator-logic';
import type { AppBinding, LlmProvider, RemoteTool } from '../types';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';

const tool: RemoteTool = {
  name: 'operacional.consultarDisponibilidade',
  alias: 'operacional__consultarDisponibilidade',
  description: 'x',
  inputSchemaJson: { type: 'object', properties: {} },
  module: 'operacional',
  permissions: ['operacional:view'],
};

const okApp: AppBinding = {
  ping: async () => ({
    ok: true,
    contractVersion: BRIDGE_RPC_VERSION,
    from: 'ia-bridge',
    now: 0,
  }),
  dbHealth: async () => ({ ok: true, contractVersion: BRIDGE_RPC_VERSION }),
  listTools: async () => ({
    ok: true,
    contractVersion: BRIDGE_RPC_VERSION,
    catalog: { version: 'v1', tools: [tool] },
  }),
  executeAction: async () => ({ ok: true, contractVersion: BRIDGE_RPC_VERSION, data: {} }),
};

const callTool = (args = '{}') => ({
  text: null as string | null,
  toolCalls: [
    {
      id: 'c1',
      type: 'function' as const,
      function: {
        name: 'operacional__consultarDisponibilidade',
        arguments: args,
      },
    },
  ],
});

const provider = (seq: any[]) => {
  let i = 0;
  return {
    complete: async () => seq[Math.min(i++, seq.length - 1)],
  } as LlmProvider;
};

const base = {
  handle: 'h',
  conversationId: 'c1',
  source: 'system' as const,
  personaType: 'recepcao' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'oi',
};

describe('runTurn — robustez', () => {
  it('recovers from forbidden (fed back as tool error)', async () => {
    const p = provider([
      callTool(),
      { text: 'Não tenho permissão para isso.', toolCalls: [] },
    ]);
    const r = await runTurn(
      {
        provider: p,
        app: {
          ...okApp,
          executeAction: async () => ({
            ok: false,
            contractVersion: BRIDGE_RPC_VERSION,
            error: 'forbidden',
            level: 'proibido',
            message: 'Sem permissão.',
          }),
        },
        now: new Date(),
      },
      base,
    );
    expect(r.reply).toContain('permissão');
  });

  it('handles malformed tool args', async () => {
    const p = provider([
      {
        text: null,
        toolCalls: [
          {
            id: 'c1',
            type: 'function',
            function: {
              name: 'operacional__consultarDisponibilidade',
              arguments: '{bad',
            },
          },
        ],
      },
      { text: 'ok', toolCalls: [] },
    ]);
    expect(
      (await runTurn({ provider: p, app: okApp, now: new Date() }, base))
        .reply,
    ).toBe('ok');
  });

  it('non-empty fallback on empty completion', async () => {
    expect(
      (
        await runTurn(
          {
            provider: provider([{ text: null, toolCalls: [] }]),
            app: okApp,
            now: new Date(),
          },
          base,
        )
      ).reply.length,
    ).toBeGreaterThan(0);
  });
});
