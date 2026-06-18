import { assignUserAccess } from '../actions/assign-user-access';
import { setModuleContract } from '../actions/set-module-contract';

it('assignUserAccess requires core:manage_users and validates input', () => {
  expect(assignUserAccess.module).toBe('core');
  expect(assignUserAccess.requires).toBe('core:manage_users');
  expect(assignUserAccess.input.safeParse({ userId: 'x', clinicId: 'y', roleId: 'z' }).success).toBe(true);
  expect(assignUserAccess.input.safeParse({}).success).toBe(false);
});

it('setModuleContract is master-only', () => {
  expect(setModuleContract.requires).toBe('master:manage_modules');
});
