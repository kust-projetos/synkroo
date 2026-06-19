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
}

export type ActionErrorCode =
  | 'unauthenticated' | 'module_disabled' | 'forbidden'
  | 'invalid_input' | 'not_found' | 'conflict' | 'internal';

export type ActionResult<O> =
  | { ok: true; data: O }
  | { ok: false; error: { code: ActionErrorCode; message: string } };

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
  // campos do input a mascarar no log (LGPD). Default: [].
  sensitiveFields?: string[];
  handler: (input: z.infer<I>, ctx: ActionContext) => Promise<O>;
}
