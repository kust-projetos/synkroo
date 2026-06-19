import { makeManifest } from '../manifest';

it('reports enabled modules and defaults missing to disabled', async () => {
  const m = makeManifest({ getEnabledModuleIds: async () => ['operacional'] });
  expect(await m.isEnabled('operacional')).toBe(true);
  expect(await m.isEnabled('financeiro')).toBe(false);
});

it('always-on modules (core) are enabled regardless of contract', async () => {
  const m = makeManifest({ getEnabledModuleIds: async () => [] });
  expect(await m.isEnabled('core')).toBe(true);
});

it('caches the lookup within an instance', async () => {
  let calls = 0;
  const m = makeManifest({ getEnabledModuleIds: async () => { calls++; return ['core']; } });
  await m.isEnabled('core'); await m.isEnabled('operacional');
  expect(calls).toBe(1);
});
