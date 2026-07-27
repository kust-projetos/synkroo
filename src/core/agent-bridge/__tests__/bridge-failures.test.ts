import { executeActionLogic, type BridgeDeps } from '../bridge-service';
import { issueHandle } from '../handle';
import { normalizeToolName } from '../tool-catalog';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';

const SECRET = 'secret-test';
const ctx = {
  source: 'system',
  clinicId: 'c1',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'agente (sistema)' },
} as unknown as ActionContext;

const mk = (
  name: string,
  requires = 'operacional:view',
): ActionDefinition<any, any> =>
  ({
    name,
    module: 'operacional',
    requires,
    label: name,
    input: { safeParse: () => ({ success: true, data: {} }) },
  } as unknown as ActionDefinition<any, any>);

function deps(seen = new Set<string>()): BridgeDeps {
  return {
    secret: SECRET,
    store: {
      async wasSeen(j: string) {
        return seen.has(j);
      },
      async markSeen(j: string, _t: number) {
        seen.add(j);
      },
    },
    getActions: () => [
      mk('operacional.consultarDisponibilidade'),
      mk('operacional.cancelarConsulta', 'operacional:manage_appointments'),
    ],
    runAction: async () => ({ ok: true as const, data: {} }),
    buildSystemContext: async () => ctx,
    buildDelegatedContext: async () => ctx,
  };
}

const issueArgs = {
  clinicId: 'c1',
  conversationId: 'conv-1',
  principalRef: 'agente',
  source: 'system' as const,
};

describe('bridge — matriz de falhas', () => {
  it('handle expirado → expired', async () => {
    const { handle } = await issueHandle(SECRET, {
      ...issueArgs,
      ttlSeconds: -1,
    });
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-expired',
      alias: normalizeToolName('operacional.consultarDisponibilidade'),
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toMatchObject({ ok: false, error: 'expired' });
  });

  it('handle de outra conversa → conversation_mismatch', async () => {
    const { handle } = await issueHandle(SECRET, {
      ...issueArgs,
      ttlSeconds: 60,
    });
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'OTHER',
      idempotencyKey: 'ik-mismatch',
      alias: normalizeToolName('operacional.consultarDisponibilidade'),
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toMatchObject({ ok: false, error: 'conversation_mismatch' });
  });

  it('replay por idempotencyKey → duplicate', async () => {
    const seen = new Set<string>();
    const d = deps(seen);
    const { handle } = await issueHandle(SECRET, {
      ...issueArgs,
      ttlSeconds: 60,
    });
    const first = await executeActionLogic(d, {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-replay',
      alias: normalizeToolName('operacional.consultarDisponibilidade'),
      input: {},
      flags: { confirmed: false },
    });
    const second = await executeActionLogic(d, {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-replay',
      alias: normalizeToolName('operacional.consultarDisponibilidade'),
      input: {},
      flags: { confirmed: false },
    });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, error: 'duplicate' });
  });

  it('alias desconhecido → unknown_tool', async () => {
    const { handle } = await issueHandle(SECRET, {
      ...issueArgs,
      ttlSeconds: 60,
    });
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-unknown',
      alias: 'nao__existe',
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
  });

  it('ação fora do allowlist (system) → unknown_tool, sem marcação de idempotência nem runAction', async () => {
    const seen = new Set<string>();
    let runCalls = 0;
    const d = deps(seen);
    const dWithProbe: BridgeDeps = {
      ...d,
      runAction: async () => {
        runCalls++;
        return { ok: true as const, data: {} };
      },
    };
    const { handle } = await issueHandle(SECRET, {
      ...issueArgs,
      ttlSeconds: 60,
    });
    const r = await executeActionLogic(dWithProbe, {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-cancel-fora-allowlist',
      alias: normalizeToolName('operacional.cancelarConsulta'),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
    // A barreira do allowlist é a primeira a ser aplicada — não chama runAction.
    expect(runCalls).toBe(0);
    // Não consome a chave de idempotência — IA pode corrigir o alias.
    expect(seen.has('conv-1:ik-cancel-fora-allowlist')).toBe(false);
  });
});
