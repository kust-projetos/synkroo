import { filterMenuByAccess, assertModuleForJob, ModuleDisabledError, withModuleRoute } from '../gates';

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

it('withModuleRoute returns 404 for disabled module', async () => {
  const handler = jest.fn(async () => new Response('ok', { status: 200 }));
  const gated = withModuleRoute('financeiro', manifest)(handler);

  const response = await gated();

  expect(response.status).toBe(404);
  expect(handler).not.toHaveBeenCalled();
});

it('withModuleRoute calls handler for enabled module', async () => {
  const handler = jest.fn(async () => new Response('ok', { status: 200 }));
  const gated = withModuleRoute('operacional', manifest)(handler);

  const response = await gated();

  expect(response.status).toBe(200);
  expect(await response.text()).toBe('ok');
  expect(handler).toHaveBeenCalledTimes(1);
});
