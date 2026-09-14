/**
 * Follow-up e Retenção — module public surface.
 *
 * Exports: actions array, manifest, permissions.
 * Bootstrap (core/actions/bootstrap.ts) handles registerActions() via
 * the exported followupActions array.
 */

import { executarFollowup } from './actions/executar-followup';
import { registrarFollowup } from './actions/registrar-followup';
import { listarPendentes } from './actions/listar-pendentes';
import { detectarInativos } from './actions/detectar-inativos';
import { listarInativos } from './actions/listar-inativos';
import { reativarPaciente } from './actions/reativar-paciente';
import { executarCampanhas } from './actions/executar-campanhas';
import { listarSegmentos } from './actions/listar-segmentos';
import { listarOrcamentosPendentes } from './actions/listar-orcamentos-pendentes';
import { executarFollowupOrcamentos } from './actions/executar-followup-orcamentos';
import { listarTratamentosIncompletos } from './actions/listar-tratamentos-incompletos';

export const followupActions = [
  executarFollowup,
  registrarFollowup,
  listarPendentes,
  detectarInativos,
  listarInativos,
  reativarPaciente,
  executarCampanhas,
  listarSegmentos,
  listarOrcamentosPendentes,
  executarFollowupOrcamentos,
  listarTratamentosIncompletos,
];

// ─── Seams públicos para services legados (R3) ───────────────────────────────
// Re-exports nomeados do mesmo binding — sem mudança de comportamento.
// (phone-resolver já exposto via `export *` abaixo.)
export { executarFollowup } from './actions/executar-followup';
export { detectarInativos } from './actions/detectar-inativos';
export { executarCampanhas } from './actions/executar-campanhas';

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { followupManifest } from './manifest';
export { followupAccessPermissions } from './permissions';
export * from './services/phone-resolver';
