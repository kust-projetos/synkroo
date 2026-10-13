import type { z } from 'zod';

export type ContextSource = 'user' | 'agent_delegated' | 'system';

export interface ActionContext {
  source: ContextSource;
  clinicId: string;                 // clínica ativa
  user?: { id: string; email: string; name: string };
  role?: string;
  can: (permissionKey: string) => boolean;
  hasModule: (moduleId: string) => boolean;
  audit: { actor: string; onBehalfOf?: string };
  /**
   * Token opaco de aprovação (single-use, TTL) — válido somente para Actions
   * de classe APPROVAL explícita (`riskClass: 'approval'`). Opcional: ausência
   * = forbidden (deny-by-default preservado). NUNCA eleva um DENY
   * (`riskClass: 'deny_non_human'`): o runAction recusa antes de consumir o
   * token. Nunca logar o valor cru.
   */
  approvalToken?: string;
}

export type ActionErrorCode =
  | 'unauthenticated' | 'module_disabled' | 'forbidden'
  | 'invalid_input' | 'not_found' | 'conflict' | 'internal'
  /**
   * E3 — estados do contrato de efeito consequencial (auditoria fail-closed):
   * - 'audit_incomplete': a tentativa NÃO pôde ser registrada antes do efeito —
   *   recusa fail-closed; o handler não executou (nenhum efeito ocorreu).
   * - 'unknown_effect': a tentativa foi registrada, mas a finalização falhou
   *   DEPOIS de o handler rodar — o estado do efeito é desconhecido. Nunca
   *   interpretar como "seguro reenviar": sem retry automático (duplicate-send).
   */
  | 'audit_incomplete' | 'unknown_effect';

export interface ActionErrorInfo {
  code: ActionErrorCode;
  message: string;
  /**
   * Referência da tentativa em `action_logs` (E3). Presente nos estados
   * 'audit_incomplete' / 'unknown_effect' para reconciliação manual —
   * permite localizar a linha iniciada sem retry cego.
   */
  attemptId?: string;
}

export type ActionResult<O> =
  | { ok: true; data: O }
  | { ok: false; error: ActionErrorInfo };

// Erro de domínio que o handler pode lançar para mapear código + mensagem segura.
export class ActionError extends Error {
  constructor(public code: ActionErrorCode, message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

export interface ActionDefinition<I extends z.ZodTypeAny = z.ZodTypeAny, O = unknown> {
  name: string;
  module: string;
  requires: string;
  label: string;
  description?: string;
  input: I;
  /**
   * Classe de risco (política determinística do `runAction`):
   * - 'standard' (padrão): sem gate extra de política.
   * - 'deny_non_human': efeito externo irreversível (ex.: envio) — DENY
   *   ABSOLUTO para principal não-humano (`source !== 'user'`). Approval token
   *   NUNCA eleva esse veredito (decisão humana vinculante E3).
   * - 'approval': classe APPROVAL explícita — principal não-humano exige
   *   approval token single-use/TTL amarrado. Nenhuma Action de produção usa
   *   esta classe hoje (nada foi reclassificado automaticamente); ela existe
   *   para o contrato APPROVAL permanecer exercitável sem afrouxar o DENY.
   */
  riskClass?: 'standard' | 'deny_non_human' | 'approval';
  /**
   * Efeito consequencial (externo/irreversível). Quando `true`, o `runAction`
   * persiste a tentativa em `action_logs` ANTES de executar o handler e
   * finaliza a MESMA linha depois. Falha da escrita inicial ⇒ fail-closed
   * (handler não executa). Falha da finalização ⇒ resultado explícito
   * `unknown_effect` com `attemptId`, sem retry automático.
   */
  consequential?: boolean;
  // Campos de metadata seguros para o log. O padrão é nenhum campo.
  auditFields?: readonly string[];
  handler: (input: z.infer<I>, ctx: ActionContext) => Promise<O>;
}
