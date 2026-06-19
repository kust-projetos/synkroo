import { assignUserAccess } from './actions/assign-user-access';
import { createRole } from './actions/create-role';
import { setModuleContract } from './actions/set-module-contract';

export const coreActions = [assignUserAccess, createRole, setModuleContract];
export { coreManifest } from './manifest';
export { coreAccessPermissions } from './permissions';
