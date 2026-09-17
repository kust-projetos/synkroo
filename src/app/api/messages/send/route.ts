import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { enviarMensagem } from '@/modules/atendimento/actions/enviar-mensagem';
import { apiRateLimited, generateRequestId } from '@/lib/api/response';
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
} from '@/lib/rate-limit';

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  // Limiter-before-auth: session validation lives inside
  // runAtendimentoAction, tal como appointments/patients fazem com
  // validateApiAuth — o padrão auth-before-limiter vale para os
  // transports com credencial prévia (cron/webhook/widget).
  const rateLimit = checkRateLimit(
    getClientIdentifier(request),
    rateLimitPresets.messages,
  );
  if (!rateLimit.allowed) {
    return apiRateLimited(
      generateRequestId(),
      rateLimit.retryAfter ?? 0,
      'Rate limit exceeded.',
    );
  }
  const body = await request.json();
  return runAtendimentoAction(enviarMensagem, body, { okStatus: 201 });
}

const wrapped = withModuleRoute('atendimento')(handlePOST);
export { wrapped as POST };
