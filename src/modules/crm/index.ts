/** CRM — module public surface. */
export {
  recalculateDuplicatesForLead,
  recalculateDuplicatesForPatient,
} from './services/duplicate-detection-service';
export { getOwnerMergeDispatcher } from './services/owner-merge-registry';
export { crmManifest } from './manifest';
export { crmAccessPermissions, crmPermissions } from './permissions';
export type { CrmPermission } from './permissions';
// Public actions (Task 4 — CRM Integration Closure).
// 15 ações humanas (6 contatos + 4 review duplicates + 2 merge executors + 3 consent).
// system-only reprocessarSugestoesDuplicidade e owner merges NÃO entram aqui.
export {
  crmActions,
  crmContactReadActions,
  crmDuplicateReviewActions,
  listarContatos,
  obterContato,
  listarTimelineContato,
  listarNotasContato,
  adicionarNotaContato,
  atualizarTagsContato,
  listarSugestoesDuplicidade,
  obterSugestaoDuplicidade,
  aprovarSugestaoDuplicidade,
  dispensarSugestaoDuplicidade,
  executarMergePatient,
  executarMergeLead,
  reprocessarSugestoesDuplicidade,
} from './actions';
