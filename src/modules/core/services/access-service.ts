import { ActionError } from '@/core/actions/types';
import * as usersRepo from '../repositories/users-repository';
import * as rolesRepo from '../repositories/roles-repository';
import * as accessRepo from '../repositories/access-repository';
import { RESERVED_ROLE_OWNER } from '@/core/rbac/presets';

export { listClinicUsers } from '../repositories/users-repository';

// ── Anti-lockout invariant ───────────────────────────────────────────────────

export async function assertOwnerInvariant(input: {
  clinicId: string;
  userId: string;
  nextRoleId?: string | null;
  nextIsActive?: boolean;
  operation: 'downgrade' | 'remove' | 'deactivate';
}) {
  const ownerRole = await rolesRepo.getOwnerRole(input.clinicId, RESERVED_ROLE_OWNER);
  if (!ownerRole) return;

  const current = await accessRepo.getUserClinicAccess(input.userId, input.clinicId);
  const isCurrentlyOwner = current?.roleId === ownerRole.id;
  if (!isCurrentlyOwner) return;

  const keepsOwnerRole = input.nextRoleId === ownerRole.id;
  const keepsActive = input.nextIsActive !== false;
  if (keepsOwnerRole && keepsActive) return;

  const activeOwnerCount = await accessRepo.countActiveUsersWithRole(input.clinicId, ownerRole.id);
  if (activeOwnerCount <= 1) {
    const verb = input.operation === 'remove' ? 'remover' : input.operation === 'deactivate' ? 'desativar' : 'rebaixar';
    throw new ActionError('conflict', `Não é possível ${verb} o último Owner ativo da clínica.`);
  }
}

// ── Assign ───────────────────────────────────────────────────────────────────

export async function assignUserAccess(input: {
  userId: string;
  clinicId: string;
  roleId: string;
}) {
  const scope = await accessRepo.getUserRoleScope(input.userId, input.roleId);
  if (!scope || scope.userClinicId !== input.clinicId || scope.roleClinicId !== input.clinicId) {
    throw new ActionError('forbidden', 'Usuário ou perfil pertence a outra clínica.');
  }

  await assertOwnerInvariant({
    clinicId: input.clinicId,
    userId: input.userId,
    nextRoleId: input.roleId,
    operation: 'downgrade',
  });
  await accessRepo.upsertUserAccess(input);
  return { ok: true };
}

// ── Remove ───────────────────────────────────────────────────────────────────

export async function removeUserAccess(input: { userId: string; clinicId: string }) {
  if (!await usersRepo.getUserInClinic(input.userId, input.clinicId)) {
    throw new ActionError('forbidden', 'Usuário não pertence à clínica ativa.');
  }

  await assertOwnerInvariant({
    clinicId: input.clinicId,
    userId: input.userId,
    nextRoleId: null,
    operation: 'remove',
  });
  await accessRepo.removeUserAccess(input.userId, input.clinicId);
  return { ok: true };
}

// ── Deactivate ───────────────────────────────────────────────────────────────

export async function deactivateUser(input: { userId: string; clinicId: string }) {
  if (!await usersRepo.getUserInClinic(input.userId, input.clinicId)) {
    throw new ActionError('forbidden', 'Usuário não pertence à clínica ativa.');
  }

  await assertOwnerInvariant({
    clinicId: input.clinicId,
    userId: input.userId,
    nextIsActive: false,
    operation: 'deactivate',
  });
  await usersRepo.deactivateUser(input.userId, input.clinicId);
  return { ok: true };
}
