'use server';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
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
