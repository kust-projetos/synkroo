/**
 * Comercial — module public surface.
 *
 * Exports: actions array, manifest, permissions.
 * Bootstrap handles registerActions() via the exported comercialActions array.
 */

import { capturarLead } from './actions/capturar-lead';
import { qualificarLead } from './actions/qualificar-lead';
import { listarLeads } from './actions/listar-leads';
import { obterLead } from './actions/obter-lead';
import { atualizarLead } from './actions/atualizar-lead';
import { moverLeadEtapaAction } from './actions/mover-lead-etapa';
import { converterLead } from './actions/converter-lead';
import { agendarAvaliacao } from './actions/agendar-avaliacao';
import { listarPipeline } from './actions/listar-pipeline';
import { criarEtapaPipeline } from './actions/criar-etapa-pipeline';
import { atualizarEtapaPipeline } from './actions/atualizar-etapa-pipeline';
import { removerEtapaPipeline } from './actions/remover-etapa-pipeline';
import { reordenarEtapasPipeline } from './actions/reordenar-etapas-pipeline';
import { criarTaskComercial } from './actions/criar-task-comercial';
import { listarTasksComerciais } from './actions/listar-tasks-comerciais';
import { atualizarTaskComercial } from './actions/atualizar-task-comercial';
import { fecharTaskComercial } from './actions/fechar-task-comercial';
import { processarNotificacoesLeadsQuentes } from './actions/processar-notificacoes-leads-quentes';

export const comercialActions = [
  capturarLead,
  qualificarLead,
  listarLeads,
  obterLead,
  atualizarLead,
  moverLeadEtapaAction,
  converterLead,
  agendarAvaliacao,
  listarPipeline,
  criarEtapaPipeline,
  atualizarEtapaPipeline,
  removerEtapaPipeline,
  reordenarEtapasPipeline,
  criarTaskComercial,
  listarTasksComerciais,
  atualizarTaskComercial,
  fecharTaskComercial,
  processarNotificacoesLeadsQuentes,
];

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { comercialManifest } from './manifest';
export { comercialAccessPermissions } from './permissions';
