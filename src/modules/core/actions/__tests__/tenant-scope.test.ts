import type { ActionContext } from '@/core/actions/types';
import { assignUserAccess } from '../assign-user-access';
import { createRole } from '../create-role';
import { deactivateUser } from '../deactivate-user';
import { removeUserAccess } from '../remove-user-access';
import * as accessService from '../../services/access-service';
import * as rolesService from '../../services/roles-service';

jest.mock('../../services/access-service', () => ({
  assignUserAccess: jest.fn().mockResolvedValue({ id: 'access-1' }),
  removeUserAccess: jest.fn().mockResolvedValue({ removed: true }),
  deactivateUser: jest.fn().mockResolvedValue({ deactivated: true }),
}));
jest.mock('../../services/roles-service', () => ({
  createRole: jest.fn().mockResolvedValue({ id: 'role-1' }),
}));

const ctx: ActionContext = {
  source: 'user',
  clinicId: 'clinic-a',
  user: { id: 'user-1', email: 'user@example.test', name: 'User' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'user-1' },
};

describe('Core Actions tenant boundary', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['assignUserAccess', assignUserAccess, { userId: 'user-1', clinicId: 'clinic-b', roleId: 'role-1' }],
    ['removeUserAccess', removeUserAccess, { userId: 'user-1', clinicId: 'clinic-b' }],
    ['deactivateUser', deactivateUser, { userId: 'user-1', clinicId: 'clinic-b' }],
    ['createRole', createRole, { clinicId: 'clinic-b', name: 'Role', permissionKeys: [] }],
  ])('%s rejects a payload clinic different from trusted context', async (_name, action, input) => {
    await expect(action.handler(input as never, ctx)).rejects.toMatchObject({ code: 'forbidden' });
    expect(accessService.assignUserAccess).not.toHaveBeenCalled();
    expect(accessService.removeUserAccess).not.toHaveBeenCalled();
    expect(accessService.deactivateUser).not.toHaveBeenCalled();
    expect(rolesService.createRole).not.toHaveBeenCalled();
  });

  it('passes the trusted clinic to the assign service for matching scope', async () => {
    await expect(assignUserAccess.handler(
      { userId: 'user-1', clinicId: 'clinic-a', roleId: 'role-1' },
      ctx,
    )).resolves.toEqual({ id: 'access-1' });
    expect(accessService.assignUserAccess).toHaveBeenCalledWith({
      userId: 'user-1', clinicId: 'clinic-a', roleId: 'role-1',
    });
  });

  it('passes matching scope to createRole without widening the payload', async () => {
    await expect(createRole.handler(
      { clinicId: 'clinic-a', name: 'Role', permissionKeys: [] },
      ctx,
    )).resolves.toEqual({ id: 'role-1' });
    expect(rolesService.createRole).toHaveBeenCalledWith({
      clinicId: 'clinic-a', name: 'Role', permissionKeys: [],
    });
  });
});
