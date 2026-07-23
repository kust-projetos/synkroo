/** CRM — module public surface. */
export const crmActions = [];

export {
  recalculateDuplicatesForLead,
  recalculateDuplicatesForPatient,
} from './services/duplicate-detection-service';
export { registerOwnerMerge } from './services/duplicate-execution-service';
export { crmManifest } from './manifest';
export { crmAccessPermissions, crmPermissions } from './permissions';
export type { CrmPermission } from './permissions';
