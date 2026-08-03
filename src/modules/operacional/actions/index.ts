/**
 * Operacional module — action exports.
 * Actions are self-registering via the action registry.
 * Import here to trigger registration; do not call handlers directly from routes —
 * use runActionRoute from ../ui/route-adapter.ts instead.
 */

import { registerActions } from '@/core/actions/registry';
import { agendarConsulta } from './agendar-consulta';
import { confirmarConsulta } from './confirmar-consulta';
import { remarcarConsulta } from './remarcar-consulta';
import { cancelarConsulta } from './cancelar-consulta';
import { registrarNoShow } from './registrar-no-show';
import { listarConsultas } from './listar-consultas';
import { consultarDisponibilidade } from './consultar-disponibilidade';
import { criarPaciente } from './criar-paciente';
import { atualizarPaciente } from './atualizar-paciente';
import { listarPacientes } from './listar-pacientes';
import { obterPaciente } from './obter-paciente';
import { criarDentista } from './criar-dentista';
import { listarDentistas } from './listar-dentistas';
import { obterDentista } from './obter-dentista';
import { atualizarDentista } from './atualizar-dentista';
import { criarProcedimento } from './criar-procedimento';
import { listarProcedimentos } from './listar-procedimentos';
import { obterProcedimento } from './obter-procedimento';
import { atualizarProcedimento } from './atualizar-procedimento';
import { listarWaitlist } from './listar-waitlist';
import { entrarWaitlist } from './entrar-waitlist';
import { cancelarWaitlist } from './cancelar-waitlist';
import { listarConfigsLembrete } from './listar-configs-lembrete';
import { salvarConfigLembrete } from './salvar-config-lembrete';
import { obterConsulta } from './obter-consulta';
import { atualizarConsulta } from './atualizar-consulta';
import { reativarConsulta } from './reativar-consulta';
import { gatilhoLembrete } from './gatilho-lembrete';
import { obterModeloLembrete } from './obter-modelo-lembrete';
import { processarConfirmacaoResposta } from './processar-confirmacao-resposta';
import { listarTratamentosIncompletos } from './listar-tratamentos-incompletos';

export * from './registrar-observacao-paciente';
export * from './atualizar-tags-paciente';
export * from './agendar-consulta';
export * from './confirmar-consulta';
export * from './remarcar-consulta';
export * from './cancelar-consulta';
export * from './registrar-no-show';
export * from './listar-consultas';
export * from './consultar-disponibilidade';
export * from './criar-paciente';
export * from './atualizar-paciente';
export * from './listar-pacientes';
export * from './obter-paciente';
export * from './criar-dentista';
export * from './listar-dentistas';
export * from './obter-dentista';
export * from './atualizar-dentista';
export * from './criar-procedimento';
export * from './listar-procedimentos';
export * from './obter-procedimento';
export * from './atualizar-procedimento';
export * from './listar-waitlist';
export * from './entrar-waitlist';
export * from './cancelar-waitlist';
export * from './listar-configs-lembrete';
export * from './salvar-config-lembrete';
export * from './obter-consulta';
export * from './atualizar-consulta';
export * from './reativar-consulta';
export * from './gatilho-lembrete';
export * from './obter-modelo-lembrete';
export * from './processar-confirmacao-resposta';
export * from './listar-tratamentos-incompletos';

// Bootstrap registration — idempotent
registerActions([
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
]);
