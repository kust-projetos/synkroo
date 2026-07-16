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

// registrado globalmente (actionRegistry), mas fora do allowlist bridge IA
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

/**
 * Versão observável dos deps: permite contar side effects que DEVEM
 * acontecer (runAction) ou NÃO devem (markSeen para uma ação bloqueada).
 */
function trackedDeps(): BridgeDeps & {
  runCalls: number;
  seenMarks: string[];
  seenChecks: string[];
} {
  const seenChecks: string[] = [];
  const seenMarks: string[] = [];
  let runCalls = 0;
  const store = {
    async wasSeen(j: string) {
      seenChecks.push(j);
      return false;
    },
    async markSeen(j: string, _t: number) {
      seenMarks.push(j);
    },
  };
  const d = deps({
    store,
    runAction: async () => {
      runCalls++;
      return { ok: true as const, data: { done: true } };
    },
  });
  return Object.assign(d, { runCalls, seenMarks, seenChecks });
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

  it('omite ações registradas globalmente que não estão no allowlist IA', async () => {
    const handle = await handleFor();
    const r = await listToolsLogic(deps(), { handle, conversationId: 'conv-1' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const aliases = r.catalog.tools.map((t) => t.alias);
      // `cancelarConsulta` está em `actions` mas não no allowlist bridge IA.
      expect(aliases).not.toContain(normalizeToolName(cancelar.name));
      // Tudo o que sobrou tem de ser uma das 8 ações operacionais do plano.
      const allowedNames = new Set([
        'operacional.consultarDisponibilidade',
        'operacional.listarProcedimentos',
        'operacional.obterProcedimento',
        'operacional.agendarConsulta',
        'operacional.confirmarConsulta',
        'operacional.entrarWaitlist',
        'operacional.obterPaciente',
        'operacional.atualizarPaciente',
      ]);
      for (const t of r.catalog.tools) {
        expect(allowedNames.has(t.name)).toBe(true);
      }
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
      idempotencyKey: 'ik-livre',
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
      idempotencyKey: 'ik-confirm-block',
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
      idempotencyKey: 'ik-confirm-allow',
      alias: normalizeToolName(agendar.name),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toEqual({ ok: true, data: { done: true } });
  });

  it('blocks ação fora do allowlist (system) — unknown_tool, sem replay nem runAction', async () => {
    const handle = await handleFor();
    const d = trackedDeps();
    const r = await executeActionLogic(d, {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-cancel-bloqueado',
      alias: normalizeToolName(cancelar.name),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
    // Barreira secundária (matriz) não chega a ser consultada.
    expect(d.runCalls).toBe(0);
    // idempotencyKey NÃO pode ser marcada — a IA pode corrigir o alias.
    const expectedKey = 'conv-1:ik-cancel-bloqueado';
    expect(d.seenMarks).not.toContain(expectedKey);
  });

  it('rejects forged handle', async () => {
    const r = await executeActionLogic(deps(), {
      handle: 'forged.sig',
      conversationId: 'conv-1',
      idempotencyKey: 'ik-forged',
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
      idempotencyKey: 'ik-unknown-alias',
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
      idempotencyKey: 'ik-delegated',
      alias: normalizeToolName(agendar.name),
      input: {},
      flags: { confirmed: false },
    });
    expect(r).toEqual({ ok: true, data: { done: true } });
  });

  describe('idempotencyKey anti-replay', () => {
    it('same handle + different keys → ambos passam', async () => {
      const handle = await handleFor();
      const d = deps();
      const r1 = await executeActionLogic(d, {
        handle,
        conversationId: 'conv-1',
        idempotencyKey: 'ik-primeiro',
        alias: normalizeToolName(consultar.name),
        input: {},
        flags: { confirmed: false },
      });
      const r2 = await executeActionLogic(d, {
        handle,
        conversationId: 'conv-1',
        idempotencyKey: 'ik-segundo',
        alias: normalizeToolName(consultar.name),
        input: {},
        flags: { confirmed: false },
      });
      expect(r1).toEqual({ ok: true, data: { done: true } });
      expect(r2).toEqual({ ok: true, data: { done: true } });
    });

    it('mesma idempotencyKey → duplicate', async () => {
      const handle = await handleFor();
      const d = deps();
      const r1 = await executeActionLogic(d, {
        handle,
        conversationId: 'conv-1',
        idempotencyKey: 'ik-repetida',
        alias: normalizeToolName(consultar.name),
        input: {},
        flags: { confirmed: false },
      });
      const r2 = await executeActionLogic(d, {
        handle,
        conversationId: 'conv-1',
        idempotencyKey: 'ik-repetida',
        alias: normalizeToolName(consultar.name),
        input: {},
        flags: { confirmed: false },
      });
      expect(r1).toEqual({ ok: true, data: { done: true } });
      expect(r2).toEqual({ ok: false, error: 'duplicate' });
    });

    it('mesma key em conversas diferentes → sem colisao', async () => {
      const { handle: h1 } = await issueHandle(SECRET, {
        clinicId: 'c1',
        conversationId: 'conv-a',
        principalRef: 'agente',
        source: 'system',
        ttlSeconds: 60,
      });
      const { handle: h2 } = await issueHandle(SECRET, {
        clinicId: 'c1',
        conversationId: 'conv-b',
        principalRef: 'agente',
        source: 'system',
        ttlSeconds: 60,
      });
      const d = deps();
      const r1 = await executeActionLogic(d, {
        handle: h1,
        conversationId: 'conv-a',
        idempotencyKey: 'ik-cross',
        alias: normalizeToolName(consultar.name),
        input: {},
        flags: { confirmed: false },
      });
      const r2 = await executeActionLogic(d, {
        handle: h2,
        conversationId: 'conv-b',
        idempotencyKey: 'ik-cross',
        alias: normalizeToolName(consultar.name),
        input: {},
        flags: { confirmed: false },
      });
      expect(r1).toEqual({ ok: true, data: { done: true } });
      expect(r2).toEqual({ ok: true, data: { done: true } });
    });
  });
});
