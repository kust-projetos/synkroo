import { approvedGraph, moduleDependencies, validateDefinitions } from '../definitions';
import { makeManifest } from '../manifest';

describe('module definitions', () => {
  it('matches the approved acyclic graph', () => {
    expect(validateDefinitions()).toEqual({ ok: true });
    expect(moduleDependencies).toEqual(approvedGraph);
  });

  it('does not enable a module while one of its dependencies is disabled', async () => {
    const manifest = makeManifest({ getEnabledModuleIds: async () => ['atendimento', 'operacional'] });

    expect(await manifest.isEnabled('operacional')).toBe(true);
    expect(await manifest.isEnabled('comercial')).toBe(false);
    expect(await manifest.isEnabled('atendimento')).toBe(false);
  });

  it('enables a dependency chain only when every dependency is contracted', async () => {
    const manifest = makeManifest({
      getEnabledModuleIds: async () => ['operacional', 'comercial', 'atendimento', 'ia'],
    });

    expect(await manifest.enabledModules()).toEqual(new Set(['core', 'operacional', 'comercial', 'atendimento', 'ia']));
  });
});
