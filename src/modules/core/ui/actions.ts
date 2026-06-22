'use server';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { assignUserAccess } from '../actions/assign-user-access';
import { createRole } from '../actions/create-role';
import { listClinicUsers } from '../actions/list-clinic-users';
import { listClinicRoles } from '../actions/list-clinic-roles';
import { removeUserAccess } from '../actions/remove-user-access';
import { deactivateUser } from '../actions/deactivate-user';

export async function assignUserAccessAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(assignUserAccess, input, ctx);
}

export async function createRoleAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(createRole, input, ctx);
}

export async function listClinicUsersAction(activeClinicId: string) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(listClinicUsers, {}, ctx);
}

export async function listClinicRolesAction(activeClinicId: string) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(listClinicRoles, {}, ctx);
}

export async function removeUserAccessAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(removeUserAccess, input, ctx);
}

export async function deactivateUserAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(deactivateUser, input, ctx);
}
