/**
 * Operacional module — public surface.
 *
 * Exports: actions array, manifest, permissions.
 * Bootstrap (core/actions/bootstrap.ts) handles registerActions() — do NOT
 * call registerActions() here (Jest module caching causes stale cached values
 * on subsequent imports, breaking the exported array).
 */

import { agendarConsulta } from './actions/agendar-consulta';
import { confirmarConsulta } from './actions/confirmar-consulta';
import { remarcarConsulta } from './actions/remarcar-consulta';
import { cancelarConsulta } from './actions/cancelar-consulta';
import { registrarNoShow } from './actions/registrar-no-show';
import { listarConsultas } from './actions/listar-consultas';
import { consultarDisponibilidade } from './actions/consultar-disponibilidade';
import { criarPaciente } from './actions/criar-paciente';
import { atualizarPaciente } from './actions/atualizar-paciente';
import { listarPacientes } from './actions/listar-pacientes';
import { obterPaciente } from './actions/obter-paciente';
import { criarDentista } from './actions/criar-dentista';
import { listarDentistas } from './actions/listar-dentistas';
import { obterDentista } from './actions/obter-dentista';
import { atualizarDentista } from './actions/atualizar-dentista';
import { criarProcedimento } from './actions/criar-procedimento';
import { listarProcedimentos } from './actions/listar-procedimentos';
import { obterProcedimento } from './actions/obter-procedimento';
import { atualizarProcedimento } from './actions/atualizar-procedimento';
import { listarWaitlist } from './actions/listar-waitlist';
import { entrarWaitlist } from './actions/entrar-waitlist';
import { cancelarWaitlist } from './actions/cancelar-waitlist';
import { listarConfigsLembrete } from './actions/listar-configs-lembrete';
import { salvarConfigLembrete } from './actions/salvar-config-lembrete';
import { obterConsulta } from './actions/obter-consulta';
import { atualizarConsulta } from './actions/atualizar-consulta';
import { reativarConsulta } from './actions/reativar-consulta';
import { gatilhoLembrete } from './actions/gatilho-lembrete';
import { obterModeloLembrete } from './actions/obter-modelo-lembrete';
import { processarConfirmacaoResposta } from './actions/processar-confirmacao-resposta';
import { listarTratamentosIncompletos } from './actions/listar-tratamentos-incompletos';
import { registrarObservacaoPaciente } from './actions/registrar-observacao-paciente';
import { atualizarTagsPaciente } from './actions/atualizar-tags-paciente';

export const operacionalActions = [
  agendarConsulta,
  confirmarConsulta,
  remarcarConsulta,
  cancelarConsulta,
  registrarNoShow,
  listarConsultas,
  consultarDisponibilidade,
  criarPaciente,
  atualizarPaciente,
  listarPacientes,
  obterPaciente,
  criarDentista,
  listarDentistas,
  obterDentista,
  atualizarDentista,
  criarProcedimento,
  listarProcedimentos,
  obterProcedimento,
  atualizarProcedimento,
  listarWaitlist,
  entrarWaitlist,
  cancelarWaitlist,
  listarConfigsLembrete,
  salvarConfigLembrete,
  obterConsulta,
  atualizarConsulta,
  reativarConsulta,
  gatilhoLembrete,
  obterModeloLembrete,
  processarConfirmacaoResposta,
  listarTratamentosIncompletos,
  registrarObservacaoPaciente,
  atualizarTagsPaciente,
];

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { operacionalManifest } from './manifest';

export { obterConsulta } from './actions/obter-consulta';
export { atualizarConsulta } from './actions/atualizar-consulta';
export { reativarConsulta } from './actions/reativar-consulta';
export { gatilhoLembrete } from './actions/gatilho-lembrete';
export { obterModeloLembrete } from './actions/obter-modelo-lembrete';
export { processarConfirmacaoResposta } from './actions/processar-confirmacao-resposta';
export { listarTratamentosIncompletos } from './actions/listar-tratamentos-incompletos';
export { registrarObservacaoPaciente } from './actions/registrar-observacao-paciente';
export { atualizarTagsPaciente } from './actions/atualizar-tags-paciente';
export { operacionalAccessPermissions } from './permissions';

// Import de efeito colateral: registra mergePatients no ownerMergeRegistry do CRM.
// NÃO remover — nenhum símbolo exportado, mas sem este import o owner-merge
// de patient falha silenciosamente em runtime (dispatcher não encontrado).
import '@/modules/crm/services/patient-merge-dispatcher';
