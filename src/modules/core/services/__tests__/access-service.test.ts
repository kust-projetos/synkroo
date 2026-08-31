/**
 * Unit tests for access-service — owner anti-lockout invariant and tenancy/cross-tenant boundaries.
 * All repository dependencies are mocked.
 * Each test sets up its own mocks — no cross-test bleed.
 */

jest.unmock('@/modules/core/services/access-service');

const mockGetOwnerRole = jest.fn();
const mockGetUserClinicAccess = jest.fn();
const mockCountActiveUsersWithRole = jest.fn();
const mockUpsertUserAccess = jest.fn();
const mockRemoveUserAccess = jest.fn();
const mockDeactivateUser = jest.fn();
const mockGetUserInClinic = jest.fn();
const mockGetUserRoleScope = jest.fn();
const mockHasMasterPermission = jest.fn();

jest.mock('@/modules/core/repositories/roles-repository', () => ({
  getOwnerRole: (...args: unknown[]) => mockGetOwnerRole(...args),
  hasMasterPermission: (...args: unknown[]) => mockHasMasterPermission(...args),
}));

jest.mock('@/modules/core/repositories/access-repository', () => ({
  getUserClinicAccess: (...args: unknown[]) => mockGetUserClinicAccess(...args),
  getUserRoleScope: (...args: unknown[]) => mockGetUserRoleScope(...args),
  countActiveUsersWithRole: (...args: unknown[]) => mockCountActiveUsersWithRole(...args),
  upsertUserAccess: (...args: unknown[]) => mockUpsertUserAccess(...args),
  removeUserAccess: (...args: unknown[]) => mockRemoveUserAccess(...args),
}));

jest.mock('@/modules/core/repositories/users-repository', () => ({
  deactivateUser: (...args: unknown[]) => mockDeactivateUser(...args),
  getUserInClinic: (...args: unknown[]) => mockGetUserInClinic(...args),
}));

import {
  assignUserAccess,
  removeUserAccess,
  deactivateUser,
  assertOwnerInvariant,
} from '../access-service';
import { ActionError } from '@/core/actions/types';

const OWNER_ROLE_ID = 'owner-role-id';
const USER_ID = 'user-id';
const CLINIC_ID = 'clinic-id';
const OTHER_CLINIC_ID = 'other-clinic-id';
const OTHER_ROLE_ID = 'other-role-id';
const RECEP_ROLE_ID = 'recep-role-id';

// Cada describe reseta os mocks no início — cada teste é independente
beforeEach(() => {
  jest.resetAllMocks();
  // default: Owner role existe na clínica
  mockGetOwnerRole.mockResolvedValue({ id: OWNER_ROLE_ID });
  mockGetUserRoleScope.mockResolvedValue({ userId: USER_ID, userClinicId: CLINIC_ID, roleClinicId: CLINIC_ID });
  mockHasMasterPermission.mockResolvedValue(false);
  mockGetUserInClinic.mockResolvedValue({ id: USER_ID, clinicId: CLINIC_ID });
});

describe('assignUserAccess — tenancy and cross-tenant entity boundaries', () => {
  it('rejects when user or role scope is not found in database', async () => {
    mockGetUserRoleScope.mockResolvedValue(null);

    await expect(
      assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Usuário ou perfil pertence a outra clínica.',
    });
    expect(mockUpsertUserAccess).not.toHaveBeenCalled();
  });

  it('rejects when user belongs to a foreign clinic', async () => {
    mockGetUserRoleScope.mockResolvedValue({
      userId: USER_ID,
      userClinicId: OTHER_CLINIC_ID,
      roleClinicId: CLINIC_ID,
    });

    await expect(
      assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Usuário ou perfil pertence a outra clínica.',
    });
    expect(mockUpsertUserAccess).not.toHaveBeenCalled();
  });

  it('rejects when role belongs to a foreign clinic', async () => {
    mockGetUserRoleScope.mockResolvedValue({
      userId: USER_ID,
      userClinicId: CLINIC_ID,
      roleClinicId: OTHER_CLINIC_ID,
    });

    await expect(
      assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Usuário ou perfil pertence a outra clínica.',
    });
    expect(mockUpsertUserAccess).not.toHaveBeenCalled();
  });

  it('rejects when both user and role belong to a foreign clinic', async () => {
    mockGetUserRoleScope.mockResolvedValue({
      userId: USER_ID,
      userClinicId: OTHER_CLINIC_ID,
      roleClinicId: OTHER_CLINIC_ID,
    });

    await expect(
      assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Usuário ou perfil pertence a outra clínica.',
    });
    expect(mockUpsertUserAccess).not.toHaveBeenCalled();
  });

  it('succeeds nominally when both user and role belong to the target clinic', async () => {
    mockGetUserRoleScope.mockResolvedValue({
      userId: USER_ID,
      userClinicId: CLINIC_ID,
      roleClinicId: CLINIC_ID,
    });
    mockGetUserClinicAccess.mockResolvedValue(null);
    mockUpsertUserAccess.mockResolvedValue(undefined);

    const result = await assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID });
    expect(result).toEqual({ ok: true });
    expect(mockUpsertUserAccess).toHaveBeenCalledWith({
      userId: USER_ID,
      clinicId: CLINIC_ID,
      roleId: OTHER_ROLE_ID,
    });
  });
});

describe('removeUserAccess — tenancy and cross-tenant entity boundaries', () => {
  it('rejects when user is absent or does not belong to active clinic', async () => {
    mockGetUserInClinic.mockResolvedValue(null);

    await expect(
      removeUserAccess({ userId: USER_ID, clinicId: CLINIC_ID }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Usuário não pertence à clínica ativa.',
    });
    expect(mockRemoveUserAccess).not.toHaveBeenCalled();
  });

  it('succeeds nominally when user belongs to active clinic', async () => {
    mockGetUserInClinic.mockResolvedValue({ id: USER_ID, clinicId: CLINIC_ID });
    mockGetUserClinicAccess.mockResolvedValue(null);
    mockRemoveUserAccess.mockResolvedValue(undefined);

    const result = await removeUserAccess({ userId: USER_ID, clinicId: CLINIC_ID });
    expect(result).toEqual({ ok: true });
    expect(mockRemoveUserAccess).toHaveBeenCalledWith(USER_ID, CLINIC_ID);
  });
});

describe('deactivateUser — tenancy and cross-tenant entity boundaries', () => {
  it('rejects when user is absent or does not belong to active clinic', async () => {
    mockGetUserInClinic.mockResolvedValue(null);

    await expect(
      deactivateUser({ userId: USER_ID, clinicId: CLINIC_ID }),
    ).rejects.toMatchObject({
      code: 'forbidden',
      message: 'Usuário não pertence à clínica ativa.',
    });
    expect(mockDeactivateUser).not.toHaveBeenCalled();
  });

  it('succeeds nominally when user belongs to active clinic', async () => {
    mockGetUserInClinic.mockResolvedValue({ id: USER_ID, clinicId: CLINIC_ID });
    mockGetUserClinicAccess.mockResolvedValue(null);
    mockDeactivateUser.mockResolvedValue(undefined);

    const result = await deactivateUser({ userId: USER_ID, clinicId: CLINIC_ID });
    expect(result).toEqual({ ok: true });
    expect(mockDeactivateUser).toHaveBeenCalledWith(USER_ID, CLINIC_ID);
  });
});

describe('assignUserAccess — owner invariant', () => {
  it('bloqueia rebaixar o último Owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(1);

    await expect(
      assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID }),
    ).rejects.toThrow(ActionError);
    expect(mockUpsertUserAccess).not.toHaveBeenCalled();
  });

  it('permite rebaixar Owner quando há outro Owner ativo', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(2);
    mockUpsertUserAccess.mockResolvedValue(undefined);

    await assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID });
    expect(mockUpsertUserAccess).toHaveBeenCalledWith({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID });
  });

  it('permite reatribuir o próprio Owner a Owner (assertOwnerInvariant early-return)', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockUpsertUserAccess.mockResolvedValue(undefined);

    await assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OWNER_ROLE_ID });
    expect(mockUpsertUserAccess).toHaveBeenCalledWith({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OWNER_ROLE_ID });
  });

  it('permite rebaixar usuário não-Owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: RECEP_ROLE_ID });
    mockUpsertUserAccess.mockResolvedValue(undefined);

    await assignUserAccess({ userId: USER_ID, clinicId: CLINIC_ID, roleId: OTHER_ROLE_ID });
    expect(mockUpsertUserAccess).toHaveBeenCalled();
  });
});

describe('removeUserAccess — owner invariant', () => {
  it('bloqueia remover acesso do último Owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(1);

    await expect(removeUserAccess({ userId: USER_ID, clinicId: CLINIC_ID })).rejects.toThrow(ActionError);
    expect(mockRemoveUserAccess).not.toHaveBeenCalled();
  });

  it('permite remover acesso de Owner quando há outro Owner ativo', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(2);
    mockRemoveUserAccess.mockResolvedValue(undefined);

    await removeUserAccess({ userId: USER_ID, clinicId: CLINIC_ID });
    expect(mockRemoveUserAccess).toHaveBeenCalledWith(USER_ID, CLINIC_ID);
  });

  it('permite remover acesso de usuário não-Owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: RECEP_ROLE_ID });
    mockRemoveUserAccess.mockResolvedValue(undefined);

    await removeUserAccess({ userId: USER_ID, clinicId: CLINIC_ID });
    expect(mockRemoveUserAccess).toHaveBeenCalled();
  });
});

describe('deactivateUser — owner invariant', () => {
  it('bloqueia desativar o último Owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(1);

    await expect(deactivateUser({ userId: USER_ID, clinicId: CLINIC_ID })).rejects.toThrow(ActionError);
    expect(mockDeactivateUser).not.toHaveBeenCalled();
  });

  it('permite desativar Owner quando há outro Owner ativo', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(2);
    mockDeactivateUser.mockResolvedValue(undefined);

    await deactivateUser({ userId: USER_ID, clinicId: CLINIC_ID });
    expect(mockDeactivateUser).toHaveBeenCalledWith(USER_ID, CLINIC_ID);
  });

  it('permite desativar usuário não-Owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: RECEP_ROLE_ID });
    mockDeactivateUser.mockResolvedValue(undefined);

    await deactivateUser({ userId: USER_ID, clinicId: CLINIC_ID });
    expect(mockDeactivateUser).toHaveBeenCalled();
  });
});

describe('assertOwnerInvariant direct', () => {
  it('allows changing owner when another active owner remains', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(2);

    await expect(assertOwnerInvariant({
      clinicId: CLINIC_ID, userId: USER_ID, nextRoleId: null, operation: 'remove',
    })).resolves.toBeUndefined();
  });

  it('fails when removing last active owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(1);

    await expect(assertOwnerInvariant({
      clinicId: CLINIC_ID, userId: USER_ID, nextRoleId: null, operation: 'remove',
    })).rejects.toBeInstanceOf(ActionError);
  });

  it('fails when deactivating last active owner', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });
    mockCountActiveUsersWithRole.mockResolvedValue(1);

    await expect(assertOwnerInvariant({
      clinicId: CLINIC_ID, userId: USER_ID, nextIsActive: false, operation: 'deactivate',
    })).rejects.toBeInstanceOf(ActionError);
  });

  it('skips check when nextRoleId keeps owner role', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: OWNER_ROLE_ID });

    await expect(assertOwnerInvariant({
      clinicId: CLINIC_ID, userId: USER_ID, nextRoleId: OWNER_ROLE_ID, operation: 'downgrade',
    })).resolves.toBeUndefined();

    expect(mockCountActiveUsersWithRole).not.toHaveBeenCalled();
  });

  it('skips check for non-owner user', async () => {
    mockGetUserClinicAccess.mockResolvedValue({ roleId: RECEP_ROLE_ID });

    await expect(assertOwnerInvariant({
      clinicId: CLINIC_ID, userId: USER_ID, nextRoleId: null, operation: 'remove',
    })).resolves.toBeUndefined();

    expect(mockCountActiveUsersWithRole).not.toHaveBeenCalled();
  });
});
