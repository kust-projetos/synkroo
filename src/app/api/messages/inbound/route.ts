import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';

/**
 * Generic inbound webhook transport.
 *
 * Replay/freshness note (A4): this contract carries no trustworthy event
 * timestamp — `receberMensagem` input is strict (`externalConversationId`,
 * `externalProvider`, `externalMessageId`, `message`, `channel`,
 * `messageType`, `metadata`) with no timestamp field, so no freshness window
 * is enforced here by design. Replay protection for this transport is the
 * combination of compensating controls:
 * - per-installation shared secret (`resolveChannelInstallation`, fail-closed
 *   with timing-safe compare; checked before rate limiting);
 * - dedup by provider event identity (`persistInboundMessage` →
 *   `onConflictDoNothing` on unique `(externalProvider, externalMessageId)`,
 *   no aggregate or side-effect change on duplicates);
 * - tenant-scoped rate limiting after successful auth.
 * See `webhook-freshness.ts` for the freshness guard applied to transports
 * that do carry a timestamp (e.g. Evolution `date_time`/`messageTimestamp`).
 */
async function handlePOST(request: NextRequest) {
  // Authenticate before rate limiting: unauthenticated/invalid requests must
  // never consume the legitimate tenant's rate-limit quota. The tenant bucket
  // is keyed by the resolved clinicId, which only exists after successful auth.
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const installationId = typeof body?.installationId === 'string' ? body.installationId : '';
  const installation = await resolveChannelInstallation({
    installationId,
    providedSecret: request.headers.get('x-webhook-secret') ?? '',
  });
  if (!installation) return NextResponse.json({ error: 'Invalid webhook' }, { status: 403 });

  const rateLimit = checkRateLimit(`tenant:${installation.clinicId}`, { ...rateLimitPresets.webhook, keyPrefix: 'msg-inbound' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const from = typeof body?.from === 'string' ? body.from : '';
  const message = typeof body?.message === 'string' ? body.message : '';
  const externalMessageId = typeof body?.externalMessageId === 'string' ? body.externalMessageId : '';
  const channel = body?.channel === 'whatsapp' || body?.channel === 'web' ? body.channel : null;
  if (!from || !message || !externalMessageId || !channel) {
    return NextResponse.json({ error: 'Missing or invalid inbound fields' }, { status: 400 });
  }

  return runAtendimentoSystemAction(receberMensagem, {
    externalConversationId: from,
    externalProvider: 'webhook',
    externalMessageId,
    message,
    channel,
    messageType: 'text',
    metadata: typeof body?.metadata === 'object' && body.metadata !== null ? body.metadata : undefined,
  }, installation.clinicId, { okStatus: 201 });
}

export const POST = withModuleRoute('atendimento')(handlePOST);
