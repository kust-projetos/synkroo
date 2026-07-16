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

  it('blocks unsafe action outside allowlist (system) — unknown_tool BEFORE matrix', async () => {
    // operacional.cancelarConsulta é destrutivo e não está em AGENT_SAFE_ACTIONS:
    // a allowlist deny-by-default deve interceptar ANTES de assertSystemAllowed.
    const handle = await handleFor();
    const r = await executeActionLogic(deps(), {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-proibido',
      alias: normalizeToolName(cancelar.name),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
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

describe('allowlist deny-by-default (AGENT_SAFE_ACTIONS)', () => {
  // Ações declaradas globalmente no registry mas FORA da allowlist.
  // Devem ser invisíveis para a IA — listTools omite e executeAction devolve
  // unknown_tool ANTES de marcar idempotência e ANTES de chamar runAction.
  const crmAprovar = {
    name: 'crm.aprovarSugestaoDuplicidade',
    module: 'crm',
    requires: 'crm:manage',
    label: 'CRM aprovar',
    input: z.object({ id: z.string() }),
  } as unknown as ActionDefinition<any, any>;

  const finCriar = {
    name: 'financeiro.criarOrcamento',
    module: 'financeiro',
    requires: 'financeiro:manage',
    label: 'Criar orçamento',
    input: z.object({ pacienteId: z.string() }),
  } as unknown as ActionDefinition<any, any>;

  const mergePacs = {
    name: 'operacional.mesclarPacientes',
    module: 'operacional',
    requires: 'operacional:manage',
    label: 'Mesclar pacientes',
    input: z.object({ origem: z.string(), destino: z.string() }),
  } as unknown as ActionDefinition<any, any>;

  const mergeLeads = {
    name: 'comercial.mesclarLeads',
    module: 'comercial',
    requires: 'comercial:manage',
    label: 'Mesclar leads',
    input: z.object({ origem: z.string(), destino: z.string() }),
  } as unknown as ActionDefinition<any, any>;

  const unsafeActions = [crmAprovar, finCriar, mergePacs, mergeLeads];

  function unsafeDeps(opts: {
    runAction: BridgeDeps['runAction'];
    store?: BridgeDeps['store'];
  }): BridgeDeps {
    return deps({
      getActions: () => [...actions, ...unsafeActions],
      runAction: opts.runAction,
      ...(opts.store ? { store: opts.store } : {}),
    });
  }

  it('listToolsLogic OMITE ações fora da allowlist mesmo que registradas', async () => {
    const handle = await handleFor();
    const r = await listToolsLogic(unsafeDeps({
      runAction: async () => ({ ok: true as const, data: {} }),
    }), { handle, conversationId: 'conv-1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const names = r.catalog.tools.map((t) => t.name);
    expect(names).not.toContain('crm.aprovarSugestaoDuplicidade');
    expect(names).not.toContain('financeiro.criarOrcamento');
    expect(names).not.toContain('operacional.mesclarPacientes');
    expect(names).not.toContain('comercial.mesclarLeads');
    // E mantém as 3 ações safe do módulo operacional usadas no teste
    expect(names).toContain('operacional.consultarDisponibilidade');
  });

  it('executeActionLogic retorna unknown_tool para cada ação fora da allowlist', async () => {
    for (const unsafe of unsafeActions) {
      const handle = await handleFor();
      const r = await executeActionLogic(unsafeDeps({
        runAction: async () => ({ ok: true as const, data: {} }),
      }), {
        handle,
        conversationId: 'conv-1',
        idempotencyKey: `ik-unsafe-${unsafe.name}`,
        alias: normalizeToolName(unsafe.name),
        input: {},
        flags: { confirmed: true, identityVerified: true },
      });
      expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
    }
  });

  it('executeActionLogic NÃO chama runAction quando ação é fora da allowlist', async () => {
    let called = 0;
    const handle = await handleFor();
    const r = await executeActionLogic(unsafeDeps({
      runAction: async () => { called += 1; return { ok: true as const, data: {} }; },
    }), {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-unsafe-no-call',
      alias: normalizeToolName('financeiro.criarOrcamento'),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
    expect(called).toBe(0);
  });

  it('executeActionLogic NÃO marca idempotência quando ação é fora da allowlist', async () => {
    const seen = new Set<string>();
    const handle = await handleFor();
    const r = await executeActionLogic(unsafeDeps({
      runAction: async () => ({ ok: true as const, data: {} }),
      store: {
        async wasSeen(j: string) { return seen.has(j); },
        async markSeen(j: string) { seen.add(j); },
      },
    }), {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-unsafe-no-mark',
      alias: normalizeToolName('operacional.mesclarPacientes'),
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
    // A chave NÃO deve ter sido gravada — re-tentativa deve responder
    // unknown_tool novamente (sem consumir slot de idempotência).
    expect(seen.has('conv-1:ik-unsafe-no-mark')).toBe(false);
  });

  it('ordem do deny: alias inválido e unsafe action retornam unknown_tool sem chamar runAction', async () => {
    let called = 0;
    const handle = await handleFor();
    const r = await executeActionLogic(unsafeDeps({
      runAction: async () => { called += 1; return { ok: true as const, data: {} }; },
    }), {
      handle,
      conversationId: 'conv-1',
      idempotencyKey: 'ik-ordem-deny',
      alias: 'comercial__mesclarLeads',
      input: {},
      flags: { confirmed: true },
    });
    expect(r).toMatchObject({ ok: false, error: 'unknown_tool' });
    expect(called).toBe(0);
  });
});
