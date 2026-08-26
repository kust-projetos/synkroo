import { filterMenuByAccess } from '@/core/modules/gates';

function fakeManifest(enabledIds: string[]) {
  const set = new Set(enabledIds);
  return { isEnabled: async (id: string) => set.has(id) };
}

describe('F4.05 sidebar RBAC only from manifest', () => {
  it('filters by permission and module enabled', async () => {
    const menu: any[] = [
      { moduleId: 'financeiro', permission: 'financeiro:view', label: 'Financeiro', path: '/dashboard/financeiro' },
      { moduleId: 'core', permission: 'core:view', label: 'Configurações', path: '/dashboard/configuracoes' },
      { moduleId: 'financeiro', permission: 'financeiro:manage', label: 'Financeiro Admin', path: '/dashboard/financeiro/admin' },
    ];
    const manifest = fakeManifest(['core']); // financeiro disabled
    const can = (perm: string) => perm === 'core:view' || perm === 'financeiro:view';
    const out = await filterMenuByAccess(menu, manifest as any, can);
    expect(out.map((i) => i.path)).toEqual(['/dashboard/configuracoes']);
  });

  it('returns empty for viewer without permission', async () => {
    const menu: any[] = [{ moduleId: 'core', permission: 'core:manage_users', label: 'Usuarios', path: '/dashboard/configuracoes/acessos' }];
    const manifest = fakeManifest(['core']);
    const viewerCan = () => false;
    const out = await filterMenuByAccess(menu, manifest as any, viewerCan);
    expect(out).toEqual([]);
  });

  it('manifest stale check: no /dashboard/conversations', async () => {
    // mirrors manifest-paths.test.ts but via filterMenuByAccess source
    const { coreManifest } = await import('@/modules/core/manifest');
    const { operacionalManifest } = await import('@/modules/operacional/manifest');
    const all = [coreManifest, operacionalManifest].flatMap((m) => m.menu.map((i: any) => i.path));
    expect(all).not.toContain('/dashboard/conversations');
    expect(all).not.toContain('/dashboard/contacts');
  });
});
