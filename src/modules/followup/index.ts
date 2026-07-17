/**
 * Follow-up e Retenção — module public surface.
 *
 * Exports: actions array, manifest, permissions.
 * Bootstrap (core/actions/bootstrap.ts) handles registerActions() via
 * the exported followupActions array.
 */

// Import barrel triggers action registration
import './actions';

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

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { followupManifest } from './manifest';
export { followupAccessPermissions } from './permissions';
