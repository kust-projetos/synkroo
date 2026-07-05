/**
 * Comercial module — action exports.
 * Actions are self-registering via the action registry.
 * Import here to trigger registration; do not call handlers directly from routes.
 */

import { registerActions } from '@/core/actions/registry';
import { capturarLead } from './capturar-lead';
import { qualificarLead } from './qualificar-lead';
import { listarLeads } from './listar-leads';
import { obterLead } from './obter-lead';
import { atualizarLead } from './atualizar-lead';
import { moverLeadEtapaAction } from './mover-lead-etapa';
import { converterLead } from './converter-lead';
import { converterLeadSemAgendarAction } from './converter-lead-sem-agendar';
import { agendarAvaliacao } from './agendar-avaliacao';
import { listarPipeline } from './listar-pipeline';
import { criarEtapaPipeline } from './criar-etapa-pipeline';
import { atualizarEtapaPipeline } from './atualizar-etapa-pipeline';
import { removerEtapaPipeline } from './remover-etapa-pipeline';
import { reordenarEtapasPipeline } from './reordenar-etapas-pipeline';
import { criarTaskComercial } from './criar-task-comercial';
import { listarTasksComerciais } from './listar-tasks-comerciais';
import { atualizarTaskComercial } from './atualizar-task-comercial';
import { fecharTaskComercial } from './fechar-task-comercial';
import { arquivarLead } from './arquivar-lead';
import { obterEstatisticasLeads } from './obter-estatisticas-leads';
import { listarLeadsQuentes } from './listar-leads-quentes';
import { listarLeadsKanban } from './listar-leads-kanban';
import { obterAnalyticsPipeline } from './obter-analytics-pipeline';
import { listarNotificacoes } from './listar-notificacoes';
import { reconhecerNotificacao } from './reconhecer-notificacao';
import { processarNotificacoesLeadsQuentes } from './processar-notificacoes-leads-quentes';

export * from './arquivar-lead';
export * from './obter-estatisticas-leads';
export * from './listar-leads-quentes';
export * from './listar-leads-kanban';
export * from './obter-analytics-pipeline';
export * from './capturar-lead';
export * from './qualificar-lead';
export * from './listar-leads';
export * from './obter-lead';
export * from './atualizar-lead';
export * from './mover-lead-etapa';
export * from './converter-lead';
export * from './converter-lead-sem-agendar';
export * from './agendar-avaliacao';
export * from './listar-pipeline';
export * from './criar-etapa-pipeline';
export * from './atualizar-etapa-pipeline';
export * from './remover-etapa-pipeline';
export * from './reordenar-etapas-pipeline';
export * from './criar-task-comercial';
export * from './listar-tasks-comerciais';
export * from './atualizar-task-comercial';
export * from './fechar-task-comercial';
export * from './listar-notificacoes';
export * from './reconhecer-notificacao';
export * from './processar-notificacoes-leads-quentes';

// Bootstrap registration — idempotent
registerActions([
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
]);
