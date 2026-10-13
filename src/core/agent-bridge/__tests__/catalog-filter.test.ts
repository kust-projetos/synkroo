import { buildToolCatalog } from '../tool-catalog';
import { listToolsLogic, type BridgeDeps } from '../bridge-service';
import { issueHandle } from '../handle';
import { isAgentSafeAction } from '../tool-policy';
import { bootstrapActions, resetBootstrapForTests } from '@/core/actions/bootstrap';
import { clearRegistry, getActions } from '@/core/actions/registry';
import type { ActionContext, ActionDefinition } from '@/core/actions/types';
import { z } from 'zod';

beforeEach(async () => {
  clearRegistry();
  resetBootstrapForTests();
  await bootstrapActions();
});

function ctxWith(perms: Set<string>, modules: Set<string>): ActionContext {
  return {
    source: 'system',
    clinicId: 'c1',
    can: (k: string) => perms.has(k),
    hasModule: (m: string) => modules.has(m),
    audit: { actor: 'agente (sistema)' },
  } as ActionContext;
}

/** Ctx permissivo: todos os módulos e todas as permissões concedidas. */
function permissiveCtx(): ActionContext {
  return {
    source: 'system',
    clinicId: 'c1',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'agente (sistema)' },
  } as ActionContext;
}

type CatalogAction = Pick<
  ActionDefinition<any, any>,
  'name' | 'module' | 'requires' | 'label' | 'description' | 'input'
>;

function fakeAction(
  name: string,
  requires = 'operacional:view',
  module = 'operacional',
): CatalogAction {
  return {
    name,
    module,
    requires,
    label: name,
    input: z.object({}),
  };
}

describe('buildToolCatalog — interseção allowlist ∩ módulo ∩ permissão', () => {
  it('includes only tools whose module AND permission are granted', () => {
    const ctx = ctxWith(new Set(['operacional:view']), new Set(['operacional']));
    const cat = buildToolCatalog(ctx);
    expect(cat.tools.length).toBeGreaterThan(0);
    // Todas as tools retornadas devem ter `operacional:view` como permissão
    expect(cat.tools.every((t) => t.permissions.includes('operacional:view'))).toBe(true);
  });

  it('returns empty catalog when no module is enabled', () => {
    const cat = buildToolCatalog(ctxWith(new Set(), new Set()));
    expect(cat.tools).toHaveLength(0);
  });

  it('returns empty catalog when module is enabled but no permission matches', async () => {
    const ctx = ctxWith(
      new Set(['ia:chat']),
      new Set(['operacional']),
    );
    const cat = buildToolCatalog(ctx);
    // Nenhuma action de operacional requer 'ia:chat'
    expect(cat.tools).toHaveLength(0);
  });

  it('version changes when the tool set changes', async () => {
    const full = buildToolCatalog(
      ctxWith(
        new Set(['operacional:view', 'operacional:manage_appointments']),
        new Set(['operacional']),
      ),
    );
    const partial = buildToolCatalog(
      ctxWith(new Set(['operacional:view']), new Set(['operacional'])),
    );
    expect(full.version).not.toBe(partial.version);
  });
});

describe('buildToolCatalog — ctx permissivo não abre a allowlist', () => {
  it('expõe exatamente as actions registradas que estão na allowlist IA', () => {
    const cat = buildToolCatalog(permissiveCtx());
    const expected = getActions()
      .filter((a) => isAgentSafeAction(a.name))
      .map((a) => a.name)
      .sort();
    expect(cat.tools.length).toBeGreaterThan(0);
    expect([...cat.tools.map((t) => t.name)].sort()).toEqual(expected);
  });

  it('nunca expõe action registrada fora da allowlist (deny-by-default)', () => {
    const cat = buildToolCatalog(permissiveCtx());
    expect(cat.tools.every((t) => isAgentSafeAction(t.name))).toBe(true);
    // Sanidade: o registry real tem bem mais ações que as allowlisted.
    expect(getActions().length).toBeGreaterThan(cat.tools.length);
  });

  it('ações destrutivas/fora de escopo seguem ausentes mesmo com ctx total', () => {
    const aliases = buildToolCatalog(permissiveCtx()).tools.map((t) => t.alias);
    expect(aliases).not.toContain('operacional__cancelarConsulta');
    expect(aliases.some((a) => a.startsWith('crm__'))).toBe(false);
    expect(aliases.some((a) => a.startsWith('financeiro__'))).toBe(false);
  });
});

describe('buildToolCatalog — registry injetado', () => {
  it('usa a lista injetada em vez do registry global', () => {
    const cat = buildToolCatalog(permissiveCtx(), [
      fakeAction('operacional.consultarDisponibilidade'),
    ]);
    expect(cat.tools.map((t) => t.name)).toEqual([
      'operacional.consultarDisponibilidade',
    ]);
  });

  it('filtra a lista injetada com a mesma interseção', () => {
    const cat = buildToolCatalog(
      permissiveCtx(),
      [
        fakeAction('operacional.consultarDisponibilidade'),
        fakeAction('operacional.cancelarConsulta'), // registrada, fora da allowlist
        fakeAction('crm.listarLeads'), // módulo fora da allowlist IA
      ],
    );
    expect(cat.tools.map((t) => t.name)).toEqual([
      'operacional.consultarDisponibilidade',
    ]);
  });

  it('registry injetado respeita módulo e permissão do ctx', () => {
    const ctx = ctxWith(new Set(['operacional:view']), new Set(['operacional']));
    const cat = buildToolCatalog(ctx, [
      fakeAction('operacional.consultarDisponibilidade', 'operacional:view'),
      fakeAction('operacional.agendarConsulta', 'operacional:manage_appointments'),
    ]);
    expect(cat.tools.map((t) => t.name)).toEqual([
      'operacional.consultarDisponibilidade',
    ]);
  });

  it('lista injetada vazia → catálogo vazio', () => {
    expect(buildToolCatalog(permissiveCtx(), []).tools).toHaveLength(0);
  });
});

describe('buildToolCatalog — metadata only, sem capacidade de execução', () => {
  it('nenhuma tool carrega handler/run/execute', () => {
    const cat = buildToolCatalog(permissiveCtx());
    expect(cat.tools.length).toBeGreaterThan(0);
    for (const tool of cat.tools) {
      for (const value of Object.values(tool)) {
        expect(typeof value).not.toBe('function');
      }
      expect(Object.keys(tool).sort()).toEqual([
        'alias',
        'description',
        'inputSchemaJson',
        'module',
        'name',
        'permissions',
      ]);
    }
  });
});

describe('paridade: descoberta do bridge vs catálogo público', () => {
  const SECRET = 'secret-test';

  function bridgeDeps(
    actions: CatalogAction[],
    ctx: ActionContext,
  ): BridgeDeps {
    const store = {
      async wasSeen() {
        return false;
      },
      async markSeen() {},
    };
    return {
      secret: SECRET,
      store,
      getActions: () => actions as ActionDefinition<any, any>[],
      runAction: async () => ({ ok: true as const, data: {} }),
      buildSystemContext: async () => ctx,
      buildDelegatedContext: async () => ctx,
    };
  }

  it('listToolsLogic devolve exatamente o catálogo público (mesmo version)', async () => {
    const ctx = permissiveCtx();
    const actions = getActions();
    const { handle } = await issueHandle(SECRET, {
      clinicId: 'c1',
      conversationId: 'conv-parity',
      principalRef: 'agente',
      source: 'system',
      ttlSeconds: 60,
    });

    const viaBridge = await listToolsLogic(bridgeDeps(actions, ctx), {
      handle,
      conversationId: 'conv-parity',
    });
    expect(viaBridge.ok).toBe(true);
    if (!viaBridge.ok) return;

    const viaPublic = buildToolCatalog(ctx, actions);
    expect(viaBridge.catalog.version).toBe(viaPublic.version);
    expect(viaBridge.catalog.tools.map((t) => t.alias)).toEqual(
      viaPublic.tools.map((t) => t.alias),
    );
  });

  it('paridade também vale para o registry injetado', async () => {
    const ctx = permissiveCtx();
    const actions = [
      fakeAction('operacional.consultarDisponibilidade'),
      fakeAction('operacional.cancelarConsulta'),
    ];
    const { handle } = await issueHandle(SECRET, {
      clinicId: 'c1',
      conversationId: 'conv-parity-2',
      principalRef: 'agente',
      source: 'system',
      ttlSeconds: 60,
    });

    const viaBridge = await listToolsLogic(bridgeDeps(actions, ctx), {
      handle,
      conversationId: 'conv-parity-2',
    });
    expect(viaBridge.ok).toBe(true);
    if (!viaBridge.ok) return;

    const viaPublic = buildToolCatalog(ctx, actions);
    expect(viaBridge.catalog.tools.map((t) => t.name)).toEqual(
      viaPublic.tools.map((t) => t.name),
    );
    expect(viaBridge.catalog.tools.map((t) => t.name)).toEqual([
      'operacional.consultarDisponibilidade',
    ]);
  });
});
