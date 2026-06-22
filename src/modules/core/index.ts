import { assignUserAccess } from './actions/assign-user-access';
import { createRole } from './actions/create-role';
import { setModuleContract } from './actions/set-module-contract';
import { listClinicUsers } from './actions/list-clinic-users';
import { listClinicRoles } from './actions/list-clinic-roles';
import { removeUserAccess } from './actions/remove-user-access';
import { deactivateUser } from './actions/deactivate-user';

export const coreActions = [
  assignUserAccess,
  createRole,
  setModuleContract,
  listClinicUsers,
  listClinicRoles,
  removeUserAccess,
  deactivateUser,
];
export { coreManifest } from './manifest';
export { coreAccessPermissions } from './permissions';
