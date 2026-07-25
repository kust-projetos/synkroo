// Allowlist explícita das actions expostas à IA via agent-bridge.
// Deny-by-default: qualquer action.name que NÃO esteja em AGENT_SAFE_ACTIONS
// é filtrada de listToolsLogic e bloqueada em executeActionLogic antes de
// qualquer idempotency marking ou runAction.
//
// Por que literal e não derivado de módulo/permissão/security-matrix:
// - Segurança: precisa ser auditável, finito e congelado em PR. Inferência
//   por módulo/permissão vaza actions sensíveis se a permissão for broad.
// - Defesa em profundidade: assertSystemAllowed (security-matrix.ts) e o
//   RBAC do runAction continuam como segunda e terceira barreiras para as
//   poucas ações que passam pela allowlist.
//
// Política vigente: somente leitura/agendamento do módulo operacional são
// permitidos. Operações internas/sensíveis de CRM, Financeiro, Comercial
// e mesclagens do Operacional ficam invisíveis à IA.
export const AGENT_SAFE_ACTIONS: ReadonlySet<string> = new Set<string>([
  'operacional.consultarDisponibilidade',
  'operacional.listarProcedimentos',
  'operacional.obterProcedimento',
  'operacional.agendarConsulta',
  'operacional.confirmarConsulta',
  'operacional.entrarWaitlist',
  'operacional.obterPaciente',
  'operacional.atualizarPaciente',
]);

export function isAgentSafeAction(name: string): boolean {
  return AGENT_SAFE_ACTIONS.has(name);
}