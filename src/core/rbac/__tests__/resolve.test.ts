import { resolveAccess } from '../resolve';
import type { RbacRepo, ClinicAccess } from '../repository';

function repo(over: Partial<RbacRepo> = {}): RbacRepo {
  return {
    getAccess: async () => ({ roleId: 'r1', roleName: 'Recepcionista', isSystem: true } as ClinicAccess),
    getRolePermissions: async () => ['operacional:create'],
    getOverrides: async () => [],
    ...over,
  };
}

describe('resolveAccess', () => {
  it('denies when master is requested via role (no bypass)', async () => {
    const a = await resolveAccess('u', 'c', repo({ getAccess: async () => null }));
    expect(a.role).toBeNull();
    expect(a.can('master:manage_modules')).toBe(false);
  });

  it('owner role bypasses within instance but NOT master-only perms', async () => {
    const a = await resolveAccess('u', 'c', repo({
      getAccess: async () => ({ roleId: 'r0', roleName: 'Owner', isSystem: true }),
    }));
    expect(a.role).toBe('owner');
    expect(a.can('financeiro:delete')).toBe(true);
    expect(a.can('master:manage_modules')).toBe(false);   // anti-escalada
  });

  it('denies when user has no access to the clinic', async () => {
    const a = await resolveAccess('u', 'c', repo({ getAccess: async () => null }));
    expect(a.role).toBeNull();
    expect(a.can('operacional:create')).toBe(false);
  });

  it('grants permissions from the role', async () => {
    const a = await resolveAccess('u', 'c', repo());
    expect(a.can('operacional:create')).toBe(true);
    expect(a.can('operacional:delete')).toBe(false);
  });

  it('override takes precedence over role', async () => {
    const a = await resolveAccess('u', 'c', repo({
      getOverrides: async () => [
        { permissionKey: 'operacional:create', granted: false }, // remove
        { permissionKey: 'financeiro:view', granted: true },     // adiciona
      ],
    }));
    expect(a.can('operacional:create')).toBe(false);
    expect(a.can('financeiro:view')).toBe(true);
  });
});
