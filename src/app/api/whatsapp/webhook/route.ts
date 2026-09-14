import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { runAtendimentoSystemActionResult } from '@/modules/atendimento/ui/route-adapter';
import { resolveMetaInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { parseMetaMessage } from '@/modules/atendimento/integrations/meta-message.schema';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

async function handleGET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const mode = sp.get('hub.mode');
  const token = sp.get('hub.verify_token');
  const challenge = sp.get('hub.challenge');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

async function handlePOST(request: NextRequest) {
  // Verify signature before rate limit — invalid payload must not consume legitimate quota (T1 b).
  const signature = request.headers.get('x-hub-signature-256');
  const body = await request.text();
  if (!verifySignature(body, signature)) return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });

  // Rate limit pós-assinatura: excedido → 200 ignore (429 provocaria retry do
  // provider). O GET verify não tem rate limit — menor risco é não adicionar.
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'wa-webhook' });
  if (!rateLimit.allowed) {
    logger.warn('whatsapp webhook ignored', {
      event: 'rate_limited',
      reason: 'rate limit exceeded',
    });
    return NextResponse.json({ status: 'ignored' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (payload.object !== 'whatsapp_business_account') return NextResponse.json({ status: 'ignored' });

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let processed = 0;
  let deduped = 0;
  let ignored = 0;
  for (const entry of entries as Array<Record<string, unknown>>) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes as Array<Record<string, unknown>>) {
      const value = change.value as Record<string, unknown> | undefined;
      const messages = Array.isArray(value?.messages) ? value.messages : [];
      if (messages.length === 0) continue;
      const metadata = value?.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = typeof metadata?.phone_number_id === 'string' ? metadata.phone_number_id : '';
      // Assinatura válida, mas instalação desconhecida: sem dedup/segredo por
      // instalação aplicável → 200 ignore (sem retry do provider).
      const installation = await resolveMetaInstallation(phoneNumberId);
      if (!installation) {
        logger.warn('whatsapp webhook change ignored', {
          event: 'unknown_installation',
          reason: 'no installation for phone_number_id',
        });
        ignored++;
        continue;
      }

      for (const message of messages as Array<Record<string, unknown>>) {
        const from = typeof message.from === 'string' ? message.from : '';
        const externalMessageId = typeof message.id === 'string' ? message.id : '';
        // Assinatura válida, mas evento sem remetente/id → 200 ignore.
        if (!from || !externalMessageId) {
          logger.warn('whatsapp webhook message ignored', {
            event: 'unidentified_message',
            mid: externalMessageId || 'unknown',
            reason: 'missing sender or mid',
          });
          ignored++;
          continue;
        }
        // Assinatura válida + evento identificado, mas mídia não-processável →
        // 200 ignore (sem retry/drop do provider). Log seguro, sem body.
        const parsed = parseMetaMessage(message);
        if (!parsed) {
          logger.warn('whatsapp webhook message ignored', {
            event: 'unparseable_media',
            mid: externalMessageId,
            reason: 'parseMetaMessage null',
          });
          ignored++;
          continue;
        }
        // Exceção da action não aborta o lote: ignora a mensagem e segue.
        let result;
        try {
          result = await runAtendimentoSystemActionResult(receberMensagem, {
            externalConversationId: from,
            externalProvider: 'meta',
            externalMessageId,
            message: parsed.content,
            channel: 'whatsapp',
            messageType: parsed.messageType,
            metadata: { phoneNumberId },
          }, installation.clinicId);
        } catch (error) {
          logger.warn('whatsapp webhook message ignored', {
            event: 'action_exception',
            mid: externalMessageId,
            reason: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
          });
          ignored++;
          continue;
        }
        // Falha interna ao processar: retry da Meta não ajuda (inbound tem
        // dedup, outbox cobre reprocessamento) → 200 ignore + warn. Infra
        // continua visível em logs/metrics.
        if (!result.ok) {
          logger.warn('whatsapp webhook message ignored', {
            event: 'action_failed',
            mid: externalMessageId,
            reason: result.error.code,
          });
          ignored++;
          continue;
        }
        if (result.data && typeof result.data === 'object' && 'deduped' in result.data && result.data.deduped) deduped++;
        else processed++;
      }
    }
  }

  // Lote só com mensagens ignoradas → semântica ignore, sem retry do provider.
  if (processed === 0 && deduped === 0 && ignored > 0) {
    return NextResponse.json({ status: 'ignored' });
  }

  return NextResponse.json({
    success: true, processed, deduped, ignored,
  });
}

export const GET = withModuleRoute('atendimento')(handleGET);
export const POST = withModuleRoute('atendimento')(handlePOST);

function verifySignature(body: string, signature: string | null): boolean {
  if (!VERIFY_TOKEN || !APP_SECRET) {
    if (process.env.NODE_ENV !== 'development') return false;
    return true;
  }
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', APP_SECRET).update(body).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}
