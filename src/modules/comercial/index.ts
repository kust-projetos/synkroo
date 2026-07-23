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
import { converterLeadSemAgendarAction } from './actions/converter-lead-sem-agendar';
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
import { arquivarLead } from './actions/arquivar-lead';
import { obterEstatisticasLeads } from './actions/obter-estatisticas-leads';
import { listarLeadsQuentes } from './actions/listar-leads-quentes';
import { listarLeadsKanban } from './actions/listar-leads-kanban';
import { obterAnalyticsPipeline } from './actions/obter-analytics-pipeline';
import { listarNotificacoes } from './actions/listar-notificacoes';
import { reconhecerNotificacao } from './actions/reconhecer-notificacao';
import { processarNotificacoesLeadsQuentes } from './actions/processar-notificacoes-leads-quentes';

export const comercialActions = [
  arquivarLead,
  obterEstatisticasLeads,
  listarLeadsQuentes,
  listarLeadsKanban,
  obterAnalyticsPipeline,
  capturarLead,
  qualificarLead,
  listarLeads,
  obterLead,
  atualizarLead,
  moverLeadEtapaAction,
  converterLead,
  converterLeadSemAgendarAction,
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
  listarNotificacoes,
  reconhecerNotificacao,
  processarNotificacoesLeadsQuentes,
];

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { comercialManifest } from './manifest';
export { registrarNotaLead } from './actions/registrar-nota-lead';
export { atualizarTagsLead } from './actions/atualizar-tags-lead';
export { mesclarLeads } from './actions/mesclar-leads';
export { comercialAccessPermissions } from './permissions';
