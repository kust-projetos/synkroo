import {
  assignUserAccess,
  createRole,
  deactivateUser,
  listClinicUsers,
  listClinicRoles,
  removeUserAccess,
  setModuleContract,
} from '../actions';

describe('Core Actions definition and input schema matrix', () => {
  describe('assignUserAccess', () => {
    it('has correct module, permission requirement and label', () => {
      expect(assignUserAccess.name).toBe('core.assignUserAccess');
      expect(assignUserAccess.module).toBe('core');
      expect(assignUserAccess.requires).toBe('core:manage_users');
      expect(typeof assignUserAccess.label).toBe('string');
    });

    it('validates schema correctly', () => {
      expect(assignUserAccess.input.safeParse({ userId: 'u1', clinicId: 'c1', roleId: 'r1' }).success).toBe(true);
      expect(assignUserAccess.input.safeParse({ userId: '', clinicId: 'c1', roleId: 'r1' }).success).toBe(false);
      expect(assignUserAccess.input.safeParse({ userId: 'u1', clinicId: '', roleId: 'r1' }).success).toBe(false);
      expect(assignUserAccess.input.safeParse({ userId: 'u1', clinicId: 'c1', roleId: '' }).success).toBe(false);
      expect(assignUserAccess.input.safeParse({}).success).toBe(false);
    });
  });

  describe('createRole', () => {
    it('has correct module, permission requirement and label', () => {
      expect(createRole.name).toBe('core.createRole');
      expect(createRole.module).toBe('core');
      expect(createRole.requires).toBe('core:manage_users');
      expect(typeof createRole.label).toBe('string');
    });

    it('validates schema and applies default empty array for permissions', () => {
      const parsedWithoutPerms = createRole.input.safeParse({
        clinicId: 'c1',
        name: 'Recepcionista Senior',
      });
      expect(parsedWithoutPerms.success).toBe(true);
      if (parsedWithoutPerms.success) {
        expect(parsedWithoutPerms.data.permissionKeys).toEqual([]);
      }

      const parsedWithPerms = createRole.input.safeParse({
        clinicId: 'c1',
        name: 'Financeiro',
        description: 'Perfil de finanças',
        permissionKeys: ['financeiro:view', 'financeiro:edit'],
      });
      expect(parsedWithPerms.success).toBe(true);

      expect(createRole.input.safeParse({ clinicId: '', name: 'Role' }).success).toBe(false);
      expect(createRole.input.safeParse({ clinicId: 'c1', name: '' }).success).toBe(false);
      expect(createRole.input.safeParse({}).success).toBe(false);
    });
  });

  describe('deactivateUser', () => {
    it('has correct module, permission requirement and label', () => {
      expect(deactivateUser.name).toBe('core.deactivateUser');
      expect(deactivateUser.module).toBe('core');
      expect(deactivateUser.requires).toBe('core:manage_users');
      expect(typeof deactivateUser.label).toBe('string');
    });

    it('validates schema correctly', () => {
      expect(deactivateUser.input.safeParse({ userId: 'u1', clinicId: 'c1' }).success).toBe(true);
      expect(deactivateUser.input.safeParse({ userId: '', clinicId: 'c1' }).success).toBe(false);
      expect(deactivateUser.input.safeParse({ userId: 'u1', clinicId: '' }).success).toBe(false);
      expect(deactivateUser.input.safeParse({}).success).toBe(false);
    });
  });

  describe('listClinicUsers', () => {
    it('has correct module, permission requirement and label', () => {
      expect(listClinicUsers.name).toBe('core.listClinicUsers');
      expect(listClinicUsers.module).toBe('core');
      expect(listClinicUsers.requires).toBe('core:manage_users');
      expect(typeof listClinicUsers.label).toBe('string');
    });

    it('validates empty object input schema', () => {
      expect(listClinicUsers.input.safeParse({}).success).toBe(true);
    });
  });

  describe('listClinicRoles', () => {
    it('has correct module, permission requirement and label', () => {
      expect(listClinicRoles.name).toBe('core.listClinicRoles');
      expect(listClinicRoles.module).toBe('core');
      expect(listClinicRoles.requires).toBe('core:manage_users');
      expect(typeof listClinicRoles.label).toBe('string');
    });

    it('validates empty object input schema', () => {
      expect(listClinicRoles.input.safeParse({}).success).toBe(true);
    });
  });

  describe('removeUserAccess', () => {
    it('has correct module, permission requirement and label', () => {
      expect(removeUserAccess.name).toBe('core.removeUserAccess');
      expect(removeUserAccess.module).toBe('core');
      expect(removeUserAccess.requires).toBe('core:manage_users');
      expect(typeof removeUserAccess.label).toBe('string');
    });

    it('validates schema correctly', () => {
      expect(removeUserAccess.input.safeParse({ userId: 'u1', clinicId: 'c1' }).success).toBe(true);
      expect(removeUserAccess.input.safeParse({ userId: '', clinicId: 'c1' }).success).toBe(false);
      expect(removeUserAccess.input.safeParse({ userId: 'u1', clinicId: '' }).success).toBe(false);
      expect(removeUserAccess.input.safeParse({}).success).toBe(false);
    });
  });

  describe('setModuleContract', () => {
    it('is master-only and has correct module and label', () => {
      expect(setModuleContract.name).toBe('master.setModuleContract');
      expect(setModuleContract.module).toBe('core');
      expect(setModuleContract.requires).toBe('master:manage_modules');
      expect(typeof setModuleContract.label).toBe('string');
    });

    it('validates schema correctly', () => {
      expect(setModuleContract.input.safeParse({ moduleId: 'operacional', enabled: true }).success).toBe(true);
      expect(setModuleContract.input.safeParse({ moduleId: 'operacional', enabled: false }).success).toBe(true);
      expect(setModuleContract.input.safeParse({ moduleId: 123, enabled: true }).success).toBe(false);
      expect(setModuleContract.input.safeParse({ moduleId: 'operacional' }).success).toBe(false);
      expect(setModuleContract.input.safeParse({}).success).toBe(false);
    });
  });
});
