import type { ActionContext } from '@/core/actions/types';
import { runAction } from '@/core/actions/run';
import { assignUserAccess } from '../assign-user-access';
import { createRole } from '../create-role';
import { deactivateUser } from '../deactivate-user';
import { removeUserAccess } from '../remove-user-access';
import { listClinicUsers } from '../list-clinic-users';
import { listClinicRoles } from '../list-clinic-roles';
import * as accessService from '../../services/access-service';
import * as rolesService from '../../services/roles-service';

jest.mock('../../services/access-service', () => ({
  assignUserAccess: jest.fn().mockResolvedValue({ id: 'access-1' }),
  removeUserAccess: jest.fn().mockResolvedValue({ removed: true }),
  deactivateUser: jest.fn().mockResolvedValue({ deactivated: true }),
  listClinicUsers: jest.fn().mockResolvedValue([{ id: 'u1', email: 'u1@test.local', name: 'U1', isActive: true, roleId: 'r1', roleName: 'Recepcionista' }]),
}));
jest.mock('../../services/roles-service', () => ({
  createRole: jest.fn().mockResolvedValue({ id: 'role-1' }),
  listClinicRoles: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Recepcionista', description: null, isSystem: true }]),
}));

const ctx: ActionContext = {
  source: 'user',
  clinicId: 'clinic-a',
  user: { id: 'user-1', email: 'user@example.test', name: 'User' },
  can: (perm: string) => perm === 'core:manage_users',
  hasModule: (mod: string) => mod === 'core',
  audit: { actor: 'user-1' },
};

describe('Core Actions tenant boundary — handler unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['assignUserAccess', assignUserAccess, { userId: 'user-1', clinicId: 'clinic-b', roleId: 'role-1' }],
    ['removeUserAccess', removeUserAccess, { userId: 'user-1', clinicId: 'clinic-b' }],
    ['deactivateUser', deactivateUser, { userId: 'user-1', clinicId: 'clinic-b' }],
    ['createRole', createRole, { clinicId: 'clinic-b', name: 'Role', permissionKeys: [] }],
  ])('%s rejects a payload clinic different from trusted context', async (_name, action, input) => {
    await expect(action.handler(input as never, ctx)).rejects.toMatchObject({
      code: 'forbidden',
      message: 'A clínica informada não corresponde ao contexto ativo.',
    });
    expect(accessService.assignUserAccess).not.toHaveBeenCalled();
    expect(accessService.removeUserAccess).not.toHaveBeenCalled();
    expect(accessService.deactivateUser).not.toHaveBeenCalled();
    expect(rolesService.createRole).not.toHaveBeenCalled();
  });

  it('passes the trusted clinic to assignUserAccess for matching scope', async () => {
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
      { clinicId: 'clinic-a', name: 'Role', permissionKeys: ['core:manage_users'] },
      ctx,
    )).resolves.toEqual({ id: 'role-1' });
    expect(rolesService.createRole).toHaveBeenCalledWith({
      clinicId: 'clinic-a', name: 'Role', permissionKeys: ['core:manage_users'],
    });
  });

  it('passes matching scope to removeUserAccess', async () => {
    await expect(removeUserAccess.handler(
      { userId: 'user-1', clinicId: 'clinic-a' },
      ctx,
    )).resolves.toEqual({ removed: true });
    expect(accessService.removeUserAccess).toHaveBeenCalledWith({
      userId: 'user-1', clinicId: 'clinic-a',
    });
  });

  it('passes matching scope to deactivateUser', async () => {
    await expect(deactivateUser.handler(
      { userId: 'user-1', clinicId: 'clinic-a' },
      ctx,
    )).resolves.toEqual({ deactivated: true });
    expect(accessService.deactivateUser).toHaveBeenCalledWith({
      userId: 'user-1', clinicId: 'clinic-a',
    });
  });

  it('listClinicUsers uses trusted context clinicId and ignores any extraneous input', async () => {
    const res = await listClinicUsers.handler({} as never, ctx);
    expect(res).toEqual([
      expect.objectContaining({ id: 'u1', email: 'u1@test.local' }),
    ]);
    expect(accessService.listClinicUsers).toHaveBeenCalledWith('clinic-a');
  });

  it('listClinicRoles uses trusted context clinicId and ignores any extraneous input', async () => {
    const res = await listClinicRoles.handler({} as never, ctx);
    expect(res).toEqual([
      expect.objectContaining({ id: 'r1', name: 'Recepcionista' }),
    ]);
    expect(rolesService.listClinicRoles).toHaveBeenCalledWith('clinic-a');
  });
});

describe('Core Actions tenant boundary — runAction execution pipeline', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fails closed when action context is missing clinicId', async () => {
    const badCtx = { ...ctx, clinicId: '' };
    const res = await runAction(assignUserAccess, {
      userId: 'user-1', clinicId: 'clinic-a', roleId: 'role-1',
    }, badCtx);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('unauthenticated');
    }
    expect(accessService.assignUserAccess).not.toHaveBeenCalled();
  });

  it('fails closed when caller lacks core:manage_users permission', async () => {
    const noPermCtx = { ...ctx, can: () => false };
    const res = await runAction(assignUserAccess, {
      userId: 'user-1', clinicId: 'clinic-a', roleId: 'role-1',
    }, noPermCtx);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden');
    }
    expect(accessService.assignUserAccess).not.toHaveBeenCalled();
  });

  it('fails closed when core module is not enabled', async () => {
    const noModCtx = { ...ctx, hasModule: () => false };
    const res = await runAction(createRole, {
      clinicId: 'clinic-a', name: 'Test Role', permissionKeys: [],
    }, noModCtx);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('module_disabled');
    }
    expect(rolesService.createRole).not.toHaveBeenCalled();
  });

  it('fails closed with forbidden error code when input.clinicId differs from ctx.clinicId via runAction', async () => {
    const res = await runAction(assignUserAccess, {
      userId: 'user-1', clinicId: 'clinic-foreign', roleId: 'role-1',
    }, ctx);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('forbidden');
      expect(res.error.message).toBe('A clínica informada não corresponde ao contexto ativo.');
    }
    expect(accessService.assignUserAccess).not.toHaveBeenCalled();
  });

  it('rejects invalid schema inputs fail-closed before tenant check', async () => {
    const res = await runAction(assignUserAccess, {
      clinicId: 'clinic-a',
    }, ctx);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('invalid_input');
    }
    expect(accessService.assignUserAccess).not.toHaveBeenCalled();
  });

  it('executes nominally through runAction with valid input and matching clinicId', async () => {
    const res = await runAction(assignUserAccess, {
      userId: 'user-1', clinicId: 'clinic-a', roleId: 'role-1',
    }, ctx);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ id: 'access-1' });
    }
    expect(accessService.assignUserAccess).toHaveBeenCalledWith({
      userId: 'user-1', clinicId: 'clinic-a', roleId: 'role-1',
    });
  });
});
