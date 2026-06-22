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

export * from './agendar-consulta';
export * from './confirmar-consulta';
export * from './remarcar-consulta';
export * from './cancelar-consulta';
export * from './registrar-no-show';
export * from './listar-consultas';
export * from './consultar-disponibilidade';

// Bootstrap registration — idempotent
registerActions([
  agendarConsulta,
  confirmarConsulta,
  remarcarConsulta,
  cancelarConsulta,
  registrarNoShow,
  listarConsultas,
  consultarDisponibilidade,
]);
