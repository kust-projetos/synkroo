import { filterMenuByAccess, assertModuleForJob, ModuleDisabledError } from '../gates';

const manifest = { isEnabled: async (m: string) => m === 'operacional' };
const ctxCan = (k: string) => k === 'operacional:view';

it('filterMenuByAccess keeps only enabled + permitted items', async () => {
  const menu = [
    { moduleId: 'operacional', permission: 'operacional:view', label: 'Agenda' },
    { moduleId: 'financeiro', permission: 'financeiro:view', label: 'Financeiro' },   // módulo off
    { moduleId: 'operacional', permission: 'operacional:admin', label: 'Config' },     // sem permissão
  ];
  const out = await filterMenuByAccess(menu, manifest, ctxCan);
  expect(out.map((i) => i.label)).toEqual(['Agenda']);
});

it('assertModuleForJob throws for disabled module', async () => {
  await expect(assertModuleForJob('financeiro', manifest)).rejects.toBeInstanceOf(ModuleDisabledError);
  await expect(assertModuleForJob('operacional', manifest)).resolves.toBeUndefined();
});
