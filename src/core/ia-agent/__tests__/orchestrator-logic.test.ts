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

function app(o: Partial<AppBinding> = {}): AppBinding {
  return {
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
    executeAction: async () => ({
      ok: true,
      contractVersion: BRIDGE_RPC_VERSION,
      data: { slots: ['09:00'] },
    }),
    ...o,
  };
}

function provider(
  seq: Array<{ text: string | null; toolCalls?: any[] }>,
): LlmProvider {
  let i = 0;
  return {
    complete: async () => {
      const s = seq[Math.min(i++, seq.length - 1)];
      return { text: s.text, toolCalls: s.toolCalls ?? [] };
    },
  };
}

const callTool = (args = '{}') => ({
  text: null as string | null,
  toolCalls: [
    {
      id: 'call-1',
      type: 'function' as const,
      function: {
        name: 'operacional__consultarDisponibilidade',
        arguments: args,
      },
    },
  ],
});

const base = {
  handle: 'h',
  conversationId: 'c1',
  source: 'system' as const,
  personaType: 'paciente' as const,
  context: '',
  timezone: 'America/Sao_Paulo',
  userMessage: 'horários?',
};

describe('runTurn', () => {
  it('tool then final answer; passes tool_call_id as idempotencyKey', async () => {
    let seenKey = '';
    let seenVersion = '';
    const p = provider([callTool(), { text: 'Temos 09:00 livre.' }]);
    const a = app({
      executeAction: async (i) => {
        seenKey = i.idempotencyKey;
        seenVersion = i.contractVersion;
        return { ok: true, contractVersion: BRIDGE_RPC_VERSION, data: {} };
      },
    });
    const r = await runTurn({ provider: p, app: a, now: new Date() }, base);
    expect(r.reply).toBe('Temos 09:00 livre.');
    expect(seenKey).toBe('call-1');
    expect(seenVersion).toBe(BRIDGE_RPC_VERSION);
  });

  it('fails closed on an old or mismatched bridge before listing tools', async () => {
    let listCalls = 0;
    const r = await runTurn(
      {
        provider: provider([{ text: 'should not run' }]),
        app: app({
          ping: async () => ({
            ok: true,
            contractVersion: 'v1',
            from: 'old-bridge',
            now: 0,
          }),
          listTools: async () => {
            listCalls++;
            return {
              ok: true,
              contractVersion: BRIDGE_RPC_VERSION,
              catalog: { version: 'v1', tools: [tool] },
            };
          },
        }),
        now: new Date(),
      },
      base,
    );

    expect(r.turnsUsed).toBe(0);
    expect(listCalls).toBe(0);
  });

  it('includes prior history in the prompt', async () => {
    let msgs: any[] = [];
    const p: LlmProvider = {
      complete: async (m) => {
        msgs = m;
        return { text: 'ok', toolCalls: [] };
      },
    };
    await runTurn(
      { provider: p, app: app(), now: new Date() },
      {
        ...base,
        history: [
          { role: 'user' as const, content: 'pergunta antiga' },
          { role: 'assistant' as const, content: 'resposta antiga' },
        ],
      },
    );
    expect(msgs.some((m: any) => m.content === 'resposta antiga')).toBe(true);
  });

  it('on needs_confirmation returns a pendingAction bound to alias+args', async () => {
    const p = provider([callTool('{"date":"2026-06-25"}')]);
    const r = await runTurn(
      {
        provider: p,
        app: app({
          executeAction: async () => ({
            ok: false,
            contractVersion: BRIDGE_RPC_VERSION,
            error: 'needs_confirmation',
          }),
        }),
        now: new Date(),
      },
      base,
    );
    expect(r.pendingAction?.alias).toBe(
      'operacional__consultarDisponibilidade',
    );
    expect(r.pendingAction?.args).toEqual({ date: '2026-06-25' });
    expect(r.pendingAction?.token).toBeTruthy();
  });

  it('confirmed turn re-executes the ORIGINAL args, not the model output', async () => {
    let executedArgs: unknown = null;
    const pending = {
      alias: 'operacional__consultarDisponibilidade',
      args: { date: '2026-06-25' },
      token: 'tok-1',
    };
    const a = app({
      executeAction: async (i) => {
        executedArgs = i.input;
        return { ok: true, contractVersion: BRIDGE_RPC_VERSION, data: {} };
      },
    });
    // provider não deve nem ser chamado para gerar nova tool call de execução
    const r = await runTurn(
      {
        provider: provider([{ text: 'Confirmado e feito.' }]),
        app: a,
        now: new Date(),
      },
      { ...base, pendingAction: pending, confirmedToken: 'tok-1' },
    );
    expect(executedArgs).toEqual({ date: '2026-06-25' });
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it('strong-verification action succeeds only with identityVerifiedToken', async () => {
    let gotFlags: any = null;
    const pending = {
      alias: 'operacional__obterPaciente',
      args: { id: 'p1' },
      token: 'tok-2',
    };
    const a = app({
      executeAction: async (i) => {
        gotFlags = i.flags;
        return i.flags.identityVerified
          ? { ok: true, contractVersion: BRIDGE_RPC_VERSION, data: {} }
          : { ok: false, contractVersion: BRIDGE_RPC_VERSION, error: 'needs_identity' };
      },
    });
    const r = await runTurn(
      {
        provider: provider([{ text: 'feito' }]),
        app: a,
        now: new Date(),
      },
      {
        ...base,
        pendingAction: pending,
        confirmedToken: 'tok-2',
        identityVerifiedToken: 'tok-2',
      },
    );
    expect(gotFlags.identityVerified).toBe(true);
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it('confirmedToken without identityVerifiedToken → preserves pendingAction for needs_identity', async () => {
    const pending = {
      alias: 'operacional__obterPaciente',
      args: { id: 'p1' },
      token: 'tok-id',
    };
    const a = app({
      executeAction: async (i) =>
        i.flags.identityVerified
          ? { ok: true, contractVersion: BRIDGE_RPC_VERSION, data: {} }
          : { ok: false, contractVersion: BRIDGE_RPC_VERSION, error: 'needs_identity' },
    });
    const r = await runTurn(
      {
        provider: provider([{ text: 'irrelevante' }]),
        app: a,
        now: new Date(),
      },
      {
        ...base,
        pendingAction: pending,
        confirmedToken: 'tok-id',
        // sem identityVerifiedToken
      },
    );
    expect(r.pendingAction).toEqual(pending);
    expect(r.reply.toLowerCase()).toContain('identidade');
  });

  it('escalates to human on escalate_human', async () => {
    const r = await runTurn(
      {
        provider: provider([callTool()]),
        app: app({
          executeAction: async () => ({
            ok: false,
            contractVersion: BRIDGE_RPC_VERSION,
            error: 'escalate_human',
          }),
        }),
        now: new Date(),
      },
      base,
    );
    expect(r.escalated).toBe(true);
  });

  it('feeds structured error (error+level+message) back to the model', async () => {
    let toolMsg = '';
    const p: LlmProvider = {
      complete: async (m) => {
        const last = m[m.length - 1];
        if (last?.role === 'tool') {
          toolMsg = last.content;
          return { text: 'ok', toolCalls: [] };
        }
        return callTool();
      },
    };
    await runTurn(
      {
        provider: p,
        app: app({
          executeAction: async () => ({
            ok: false,
            contractVersion: BRIDGE_RPC_VERSION,
            error: 'forbidden',
            level: 'proibido',
            message: 'Sem permissão.',
          }),
        }),
        now: new Date(),
      },
      base,
    );
    expect(toolMsg).toContain('forbidden');
    expect(toolMsg).toContain('Sem permissão.');
  });

  it('falls back when listTools fails', async () => {
    const r = await runTurn(
      {
        provider: provider([{ text: 'x' }]),
        app: app({
          listTools: async () => ({
            ok: false,
            contractVersion: BRIDGE_RPC_VERSION,
            error: 'down',
          }),
        }),
        now: new Date(),
      },
      base,
    );
    expect(r.turnsUsed).toBe(0);
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it('maps empty text to fallback reply', async () => {
    const p = provider([{ text: '' }]);
    const r = await runTurn(
      { provider: p, app: app(), now: new Date() },
      base,
    );
    expect(r.reply).toBeTruthy();
    expect(r.reply.length).toBeGreaterThan(0);
    expect(r.turnsUsed).toBe(1);
  });

  it('maps whitespace-only text to fallback reply', async () => {
    const p = provider([{ text: '   \n\t ' }]);
    const r = await runTurn(
      { provider: p, app: app(), now: new Date() },
      base,
    );
    expect(r.reply).toBeTruthy();
    expect(r.reply.length).toBeGreaterThan(0);
    expect(r.turnsUsed).toBe(1);
  });

  it('stops at guard limit', async () => {
    const r = await runTurn(
      {
        provider: provider([callTool()]),
        app: app(),
        now: new Date(),
        maxIterations: 3,
      },
      base,
    );
    expect(r.turnsUsed).toBe(3);
  });
});
