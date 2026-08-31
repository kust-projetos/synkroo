import {
  assignUserAccessAction,
  createRoleAction,
  listClinicUsersAction,
  listClinicRolesAction,
  removeUserAccessAction,
  deactivateUserAction,
} from '../actions';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { assignUserAccess } from '../../actions/assign-user-access';
import { createRole } from '../../actions/create-role';
import { listClinicUsers } from '../../actions/list-clinic-users';
import { listClinicRoles } from '../../actions/list-clinic-roles';
import { removeUserAccess } from '../../actions/remove-user-access';
import { deactivateUser } from '../../actions/deactivate-user';

jest.mock('@/core/actions/run', () => ({
  runAction: jest.fn().mockResolvedValue({ ok: true, data: {} }),
}));

jest.mock('@/core/actions/context', () => ({
  buildUserContext: jest.fn().mockImplementation((clinicId: string) => Promise.resolve({
    source: 'user',
    clinicId,
    user: { id: 'u1', email: 'u1@test.local', name: 'User 1' },
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'u1' },
  })),
}));

describe('Core UI Server Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assignUserAccessAction builds context with activeClinicId and runs action', async () => {
    const input = { userId: 'u1', roleId: 'r1' };
    await assignUserAccessAction('clinic-1', input);

    expect(buildUserContext).toHaveBeenCalledWith('clinic-1');
    expect(runAction).toHaveBeenCalledWith(
      assignUserAccess,
      input,
      expect.objectContaining({ clinicId: 'clinic-1' }),
    );
  });

  it('createRoleAction builds context with activeClinicId and runs action', async () => {
    const input = { name: 'Role 1', permissionKeys: [] };
    await createRoleAction('clinic-1', input);

    expect(buildUserContext).toHaveBeenCalledWith('clinic-1');
    expect(runAction).toHaveBeenCalledWith(
      createRole,
      input,
      expect.objectContaining({ clinicId: 'clinic-1' }),
    );
  });

  it('listClinicUsersAction builds context with activeClinicId and runs action with empty object', async () => {
    await listClinicUsersAction('clinic-1');

    expect(buildUserContext).toHaveBeenCalledWith('clinic-1');
    expect(runAction).toHaveBeenCalledWith(
      listClinicUsers,
      {},
      expect.objectContaining({ clinicId: 'clinic-1' }),
    );
  });

  it('listClinicRolesAction builds context with activeClinicId and runs action with empty object', async () => {
    await listClinicRolesAction('clinic-1');

    expect(buildUserContext).toHaveBeenCalledWith('clinic-1');
    expect(runAction).toHaveBeenCalledWith(
      listClinicRoles,
      {},
      expect.objectContaining({ clinicId: 'clinic-1' }),
    );
  });

  it('removeUserAccessAction builds context with activeClinicId and runs action', async () => {
    const input = { userId: 'u1' };
    await removeUserAccessAction('clinic-1', input);

    expect(buildUserContext).toHaveBeenCalledWith('clinic-1');
    expect(runAction).toHaveBeenCalledWith(
      removeUserAccess,
      input,
      expect.objectContaining({ clinicId: 'clinic-1' }),
    );
  });

  it('deactivateUserAction builds context with activeClinicId and runs action', async () => {
    const input = { userId: 'u1' };
    await deactivateUserAction('clinic-1', input);

    expect(buildUserContext).toHaveBeenCalledWith('clinic-1');
    expect(runAction).toHaveBeenCalledWith(
      deactivateUser,
      input,
      expect.objectContaining({ clinicId: 'clinic-1' }),
    );
  });
});
