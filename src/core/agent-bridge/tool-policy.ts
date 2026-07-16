/**
 * Política de allowlist da bridge IA.
 *
 * Regra: deny-by-default. Apenas nomes explicitamente listados em
 * `AGENT_SAFE_ACTIONS` podem ser expostos como ferramenta da bridge IA
 * (`listToolsLogic`) ou executados (`executeActionLogic`).
 *
 * Não inferir permissão por módulo, security matrix, RBAC ou manifesto:
 * a lista é literal e auditável. CRM, Financeiro, mesclas internas e
 * qualquer ação destrutiva ficam fora por construção, mesmo que sejam
 * registradas globalmente no action registry.
 */

/**
 * Nomes canônicos (literalmente `module.action`) que podem ser invocados
 * pela bridge IA. Mantido como `ReadonlySet` para reduzir o risco de
 * mutação acidental por consumidores.
 */
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

/**
 * Verifica se `actionName` é uma ferramenta permitida para a bridge IA.
 *
 * - `null`/`undefined`/string vazia/não-string → `false`.
 * - Nome presente no allowlist → `true`.
 * - Qualquer outro nome → `false` (deny-by-default).
 */
export function isAgentSafeAction(actionName: unknown): actionName is string {
  if (typeof actionName !== 'string' || actionName === '') return false;
  return AGENT_SAFE_ACTIONS.has(actionName);
}
