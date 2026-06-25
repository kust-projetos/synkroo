import { z } from 'zod';
import { listToolsLogic, executeActionLogic, type BridgeDeps } from '../bridge-service';
import { issueHandle } from '../handle';
import { normalizeToolName } from '../tool-catalog';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';

const SECRET = 'secret-test';

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

const consultar = {
  name: 'operacional.consultarDisponibilidade',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Consultar disponibilidade',
  input: z.object({ pacienteId: z.string().optional() }),
} as unknown as ActionDefinition<any, any>;

const agendar = {
  name: 'operacional.agendarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Agendar consulta',
  input: z.object({ pacienteId: z.string(), data: z.string() }),
} as unknown as ActionDefinition<any, any>;

const cancelar = {
  name: 'operacional.cancelarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Cancelar consulta',
  input: z.object({ consultaId: z.string() }),
} as unknown as ActionDefinition<any, any>;

const actions = [consultar, agendar, cancelar];

function deps(
  overrides: Partial<BridgeDeps> = {},
): BridgeDeps {
  const ctx = {
    source: 'system',
    clinicId: 'c1',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'agente (sistema)' },
  } as unknown as ActionContext;
  return {
    secret: SECRET,
    store: memStore(),
    getActions: () => actions,
    runAction: async () => ({ ok: true as const, data: { done: true } }),
    buildSystemContext: async () => ctx,
    buildDelegatedContext: async () => ctx,
    ...overrides,
  };
}

async function handleFor(
  source: 'system' | 'agent_delegated' = 'system',
) {
  return (
    await issueHandle(SECRET, {
      clinicId: 'c1',
      conversationId: 'conv-1',
      principalRef: 'agente',
      source,
      ttlSeconds: 60,
    })
  ).handle;
}

describe('listToolsLogic', () => {
  it('returns filtered catalog for a valid handle', async () => {
    const handle = await handleFor();
    const r = await listToolsLogic(deps(), { handle, conversationId: 'conv-1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.catalog.tools.length).toBeGreaterThan(0);
      expect(r.catalog.tools.every((t) => t.alias.includes('operacional'))).toBe(
        true,
      );
    }
  });

  it('rejects invalid handle', async () => {
    const r = await listToolsLogic(deps(), {
      handle: 'bad.sig',
      conversationId: 'conv-1',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_signature');
  });
});

describe('executeActionLogic', () => {
  it('runs a livre action (system) and returns data', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      alias: normalizeToolName(consultar.name),
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toEqual({ ok: true, data: { done: true } });
  });

  it('blocks confirmacao action without confirmed flag (system)', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      alias: normalizeToolName(agendar.name),
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toMatchObject({ ok: false, error: 'needs_confirmation' });
  });

  it('allows confirmacao with confirmed flag (system)', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      alias: normalizeToolName(agendar.name),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toEqual({ ok: true, data: { done: true } });
  });

  it('blocks proibido action (system) — escalate_human', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      alias: normalizeToolName(cancelar.name),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toMatchObject({ ok: false, error: 'escalate_human' });
  });

  it('rejects forged handle', async () => {
    const r = await executeActionLogic(deps(), {
      handle: 'forged.sig',
      conversationId: 'conv-1',
      alias: normalizeToolName(consultar.name),
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toMatchObject({ ok: false, error: 'invalid_signature' });
  });

  it('rejects unknown alias', async () => {
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      alias: 'nao__existe',
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
  });

  it('skips security matrix for delegated source (RBAC only)', async () => {
    const handle = await handleFor('agent_delegated');
    // agendar requires confirmacao in matrix, but for delegated it skips matrix
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      alias: normalizeToolName(agendar.name),
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toEqual({ ok: true, data: { done: true } });
  });
});
