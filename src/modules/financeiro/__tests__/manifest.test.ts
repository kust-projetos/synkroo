/**
 * Unit tests: Financeiro module manifest and permissions.
 */

import { financeiroManifest } from '../manifest';
import { financeiroAccessPermissions } from '../permissions';

describe('financeiro manifest', () => {
  it('defines Financeiro menu and permissions', () => {
    expect(financeiroManifest.menu[0]).toMatchObject({
      path: '/dashboard/financeiro',
      permission: 'financeiro:view',
    });
  });

  it('menu has at least one item', () => {
    expect(financeiroManifest.menu.length).toBeGreaterThanOrEqual(1);
  });
});

describe('financeiro permissions', () => {
  it('contains all required permission keys', () => {
    const keys = financeiroAccessPermissions.map((p) => p.key);
    expect(keys).toContain('financeiro:view');
    expect(keys).toContain('financeiro:create_budget');
    expect(keys).toContain('financeiro:manage_budget');
    expect(keys).toContain('financeiro:record_payment');
    expect(keys).toContain('financeiro:manage_collections');
    expect(keys).toContain('financeiro:manage_gateways');
  });

  it('all permissions belong to financeiro module', () => {
    for (const perm of financeiroAccessPermissions) {
      expect(perm.module).toBe('financeiro');
    }
  });

  it('each permission has a label', () => {
    for (const perm of financeiroAccessPermissions) {
      expect(perm.label).toBeTruthy();
    }
  });
});
