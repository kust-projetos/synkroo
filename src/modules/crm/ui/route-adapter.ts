/**
 * CRM module — route adapter for API routes (Task 5).
 *
 * Bridges Next.js route handlers → action system. Pattern mirrors
 * `@/modules/comercial/ui/route-adapter.ts` and
 * `@/modules/atendimento/ui/route-adapter.ts`.
 *
 * Sem imports legados (validateApiAuth / getDb / services) — auth é feita
 * internamente em `buildUserContext()`.
 */
import { NextResponse } from 'next/server';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import type { ActionDefinition } from '@/core/actions/types';

const statusByCode: Record<string, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  invalid_input: 422,
  module_disabled: 404,
  internal: 500,
};

/**
 * Run a CRM action with user context (authenticated routes).
 * Injeta clinicId do contexto de auth no input antes de chamar runAction.
 */
export async function runCrmAction<O>(
  action: ActionDefinition<any, O>,
  input: Record<string, unknown>,
  opts?: { okStatus?: number },
): Promise<NextResponse> {
  let ctx;
  try {
    ctx = await buildUserContext();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }

  // Injeta clinicId do contexto de auth; permite que a action derive tenant.
  const merged = { ...input, clinicId: ctx.clinicId };
  const result = await runAction(action, merged, ctx);
  if (result.ok) {
    return NextResponse.json(result.data, { status: opts?.okStatus ?? 200 });
  }
  return NextResponse.json(
    { error: result.error.message },
    { status: statusByCode[result.error.code] ?? 500 },
  );
}

/**
 * Resposta padrão 405 para endpoints CRM em MVP read-only.
 * Aplicada a POST /contacts e PUT/PATCH /contacts/[id] — endpoints que
 * precisariam de mutação fora do escopo MVP (criar/atualizar/archive).
 * Mutações permitidas no MVP vivem em /notes (POST) e /tags (PUT).
 */
export async function crmReadOnlyResponse(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'crm_mvp_read_only' },
    { status: 405 },
  );
}
