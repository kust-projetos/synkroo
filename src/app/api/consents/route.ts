import { apiFailure, apiSuccess, generateRequestId } from '@/lib/api/response';
import { ActionError } from '@/core/actions/types';
import {
  contactQuerySchema,
  grantConsentSchema as grantSchema,
  revokeConsentSchema as revokeSchema,
} from '@/lib/validations/consent';

function statusFor(code: string): number {
  if (code === 'unauthenticated') return 401;
  if (code === 'forbidden') return 403;
  if (code === 'not_found') return 404;
  if (code === 'internal') return 500;
  return 400;
}

function responseWithId(response: Response, requestId: string) {
  response.headers.set('x-request-id', requestId);
  return response;
}

function failure(result: { ok: false; error: { code: string; message: string } }, requestId: string) {
  return responseWithId(apiFailure(result.error.code.toUpperCase(), result.error.message, requestId, statusFor(result.error.code)), requestId);
}

async function contextAndAction() {
  const { buildUserContext } = await import('@/core/actions/context');
  const { runAction } = await import('@/core/actions/run');
  return { ctx: await buildUserContext(), runAction };
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  try {
    const parsed = contactQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return responseWithId(apiFailure('INVALID_INPUT', 'contact_id e contact_type são obrigatórios.', requestId, 400), requestId);
    const { listarConsentimentos } = await import('@/modules/crm/actions/listar-consentimentos');
    const { ctx, runAction } = await contextAndAction();
    const result = await runAction(listarConsentimentos, { contactId: parsed.data.contact_id, contactType: parsed.data.contact_type }, ctx);
    if (!result.ok) return failure(result, requestId);
    return responseWithId(apiSuccess(result.data), requestId);
  } catch (error) {
    if ((error instanceof ActionError && error.code === 'unauthenticated') || (error instanceof Error && error.message === 'unauthenticated')) return responseWithId(apiFailure('UNAUTHENTICATED', 'Não autenticado.', requestId, 401), requestId);
    return responseWithId(apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500), requestId);
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  try {
    const parsed = grantSchema.safeParse(await request.json());
    if (!parsed.success) return responseWithId(apiFailure('INVALID_INPUT', 'Dados inválidos.', requestId, 400), requestId);
    const { concederConsentimento } = await import('@/modules/crm/actions/conceder-consentimento');
    const { ctx, runAction } = await contextAndAction();
    const result = await runAction(concederConsentimento, {
      contactId: parsed.data.contact_id,
      contactType: parsed.data.contact_type,
      purpose: parsed.data.purpose,
      channel: parsed.data.channel,
      version: parsed.data.version,
      notes: parsed.data.notes,
    }, ctx);
    if (!result.ok) return failure(result, requestId);
    return responseWithId(apiSuccess(result.data), requestId);
  } catch (error) {
    if ((error instanceof ActionError && error.code === 'unauthenticated') || (error instanceof Error && error.message === 'unauthenticated')) return responseWithId(apiFailure('UNAUTHENTICATED', 'Não autenticado.', requestId, 401), requestId);
    return responseWithId(apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500), requestId);
  }
}

export async function PATCH(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  try {
    const parsed = revokeSchema.safeParse(await request.json());
    if (!parsed.success) return responseWithId(apiFailure('INVALID_INPUT', 'Dados inválidos.', requestId, 400), requestId);
    const { revogarConsentimento } = await import('@/modules/crm/actions/revogar-consentimento');
    const { ctx, runAction } = await contextAndAction();
    const input = parsed.data.consent_id
      ? { consentId: parsed.data.consent_id }
      : {
        contactId: parsed.data.contact_id!,
        contactType: parsed.data.contact_type!,
        purpose: parsed.data.purpose!,
        channel: parsed.data.channel,
        notes: parsed.data.notes,
      };
    const result = await runAction(revogarConsentimento, input, ctx);
    if (!result.ok) return failure(result, requestId);
    return responseWithId(apiSuccess(result.data), requestId);
  } catch (error) {
    if ((error instanceof ActionError && error.code === 'unauthenticated') || (error instanceof Error && error.message === 'unauthenticated')) return responseWithId(apiFailure('UNAUTHENTICATED', 'Não autenticado.', requestId, 401), requestId);
    return responseWithId(apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500), requestId);
  }
}
