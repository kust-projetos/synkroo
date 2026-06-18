'use server';
import { runAction, buildUserContext } from '@/core/actions';
import { assignUserAccess } from '../actions/assign-user-access';
import { createRole } from '../actions/create-role';

export async function assignUserAccessAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(assignUserAccess, input, ctx);
}

export async function createRoleAction(activeClinicId: string, input: unknown) {
  const ctx = await buildUserContext(activeClinicId);
  return runAction(createRole, input, ctx);
}
