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
import { processarNotificacoesLeadsQuentes } from './processar-notificacoes-leads-quentes';

export * from './capturar-lead';
export * from './qualificar-lead';
export * from './listar-leads';
export * from './obter-lead';
export * from './atualizar-lead';
export * from './mover-lead-etapa';
export * from './converter-lead';
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
export * from './processar-notificacoes-leads-quentes';

// Bootstrap registration — idempotent
registerActions([
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
]);
