/**
 * Follow-up module — action exports.
 * This barrel only exports Action definitions. Registration belongs exclusively
 * to the composition root in src/core/actions/bootstrap.ts.
 */

import { executarFollowup } from './executar-followup';
import { registrarFollowup } from './registrar-followup';
import { listarPendentes } from './listar-pendentes';
import { detectarInativos } from './detectar-inativos';
import { listarInativos } from './listar-inativos';
import { reativarPaciente } from './reativar-paciente';
import { executarCampanhas } from './executar-campanhas';
import { listarSegmentos } from './listar-segmentos';
import { listarOrcamentosPendentes } from './listar-orcamentos-pendentes';
import { executarFollowupOrcamentos } from './executar-followup-orcamentos';
import { listarTratamentosIncompletos } from './listar-tratamentos-incompletos';

export * from './executar-followup';
export * from './registrar-followup';
export * from './listar-pendentes';
export * from './detectar-inativos';
export * from './listar-inativos';
export * from './reativar-paciente';
export * from './executar-campanhas';
export * from './listar-segmentos';
export * from './listar-orcamentos-pendentes';
export * from './executar-followup-orcamentos';
export * from './listar-tratamentos-incompletos';
