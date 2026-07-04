/**
 * Unit tests: Comercial manifest menu items (Task 6).
 *
 * Tests that comercialManifest menu items (Leads, Pipeline)
 * appear in buildMenu when module is enabled.
 */

import { buildMenu } from '@/lib/ui/build-menu';
import { comercialManifest } from '@/modules/comercial/manifest';

describe('comercial manifest menu', () => {
  it('exports Leads and Pipeline menu items', () => {
    const labels = comercialManifest.menu.map((m) => m.label);
    expect(labels).toContain('Leads');
    expect(labels).toContain('Pipeline');
  });

  it('menu items have correct paths', () => {
    const leads = comercialManifest.menu.find((m) => m.label === 'Leads');
    expect(leads?.path).toBe('/dashboard/leads');

    const pipeline = comercialManifest.menu.find((m) => m.label === 'Pipeline');
    expect(pipeline?.path).toBe('/dashboard/crm/pipeline');
  });

  it('includes Leads and Pipeline when module is enabled', async () => {
    const mockManifest = {
      isEnabled: async (id: string) => id === 'comercial',
    };
    const mockCan = () => true;

    const items = await buildMenu(
      [comercialManifest],
      mockManifest,
      mockCan,
    );

    const labels = items.map((i) => i.label);
    expect(labels).toContain('Leads');
    expect(labels).toContain('Pipeline');
  });

  it('excludes items when module is disabled', async () => {
    const mockManifest = {
      isEnabled: async () => false,
    };
    const mockCan = () => true;

    const items = await buildMenu(
      [comercialManifest],
      mockManifest,
      mockCan,
    );

    expect(items).toHaveLength(0);
  });
});
