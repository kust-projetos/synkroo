import { buildToolCatalog } from '../tool-catalog';
import { bootstrapActions, resetBootstrapForTests } from '@/core/actions/bootstrap';
import { clearRegistry } from '@/core/actions/registry';
import type { ActionContext } from '@/core/actions/types';

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

describe('buildToolCatalog — filtered by ctx', () => {
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
