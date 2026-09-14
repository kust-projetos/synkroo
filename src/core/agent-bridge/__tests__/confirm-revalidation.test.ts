import { z } from 'zod';
import { executeActionLogic, type BridgeDeps } from '../bridge-service';
import { issueHandle } from '../handle';
import { normalizeToolName } from '../tool-catalog';
import { runAction } from '@/core/actions/run';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';

/**
 * B1 (3c) — prova de que `pendingAction.args` (persistido no DO, fora do
 * controle do caller) é REVALIDADO via Zod antes de executar: o
 * `executeActionLogic` delega ao `runAction` real, que faz
 * `action.input.safeParse`. Args tampados → `invalid_input`, handler NUNCA roda.
 */
jest.mock('@/core/actions/audit-writer', () => {
  const actual = jest.requireActual('@/core/actions/audit-writer');
  return { ...actual, writeActionLog: jest.fn() };
});

const SECRET = 'secret-confirm-revalidation';

const handler = jest.fn(async (input: { data: string }) => ({ agendado: input.data }));

const agendar = {
  name: 'operacional.agendarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Agendar consulta',
  input: z.object({ data: z.string().min(1) }),
  handler,
} as unknown as ActionDefinition<any, any>;

function memStore() {
  const seen = new Set<string>();
  return {
    async wasSeen(j: string) {
      return seen.has(j);
    },
    async markSeen(j: string, _t: number) {
      seen.add(j);
    },
  };
}

const ctx = {
  source: 'system',
  clinicId: 'c1',
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'agente (sistema)' },
} as unknown as ActionContext;

function deps(): BridgeDeps {
  return {
    secret: SECRET,
    store: memStore(),
    getActions: () => [agendar],
    runAction,
    buildSystemContext: async () => ctx,
    buildDelegatedContext: async () => ctx,
  };
}

async function freshHandle(conversationId: string): Promise<string> {
  const { handle } = await issueHandle(SECRET, {
    clinicId: 'c1',
    conversationId,
    principalRef: 'agente',
    source: 'system',
    ttlSeconds: 120,
  });
  return handle;
}

describe('confirm revalidation — bridge safeParse em args do DO (B1)', () => {
  beforeEach(() => {
    handler.mockClear();
  });

  it('args tampados no DO → invalid_input, handler nunca executa', async () => {
    const res = await executeActionLogic(deps(), {
      handle: await freshHandle('conv-tamper'),
      conversationId: 'conv-tamper',
      idempotencyKey: 'ik-tamper-1',
      alias: normalizeToolName(agendar.name),
      // DO persistiu algo que não passa no schema (ex.: corrupção/tamper)
      input: { data: 12345 },
      flags: { confirmed: true },
    });
    expect(res).toEqual(
      expect.objectContaining({ ok: false, error: 'invalid_input' }),
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('args válidos → executa normalmente', async () => {
    const res = await executeActionLogic(deps(), {
      handle: await freshHandle('conv-ok'),
      conversationId: 'conv-ok',
      idempotencyKey: 'ik-ok-1',
      alias: normalizeToolName(agendar.name),
      input: { data: '2026-07-01' },
      flags: { confirmed: true },
    });
    expect(res).toEqual({ ok: true, data: { agendado: '2026-07-01' } });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
