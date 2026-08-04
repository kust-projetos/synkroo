import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { runAtendimentoSystemAction } from '@/modules/atendimento/ui/route-adapter';
import { receberMensagem } from '@/modules/atendimento/actions/receber-mensagem';
import { resolveChannelInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

async function handlePOST(request: NextRequest) {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, { ...rateLimitPresets.webhook, keyPrefix: 'msg-inbound' });
  if (!rateLimit.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const installationId = typeof body?.installationId === 'string' ? body.installationId : '';
  const installation = await resolveChannelInstallation({
    installationId,
    providedSecret: request.headers.get('x-webhook-secret') ?? '',
  });
  if (!installation) return NextResponse.json({ error: 'Invalid webhook' }, { status: 403 });

  const from = typeof body?.from === 'string' ? body.from : '';
  const message = typeof body?.message === 'string' ? body.message : '';
  if (!from || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  return runAtendimentoSystemAction(receberMensagem, {
    from,
    message,
    channel: typeof body?.channel === 'string' ? body.channel : 'web',
    metadata: typeof body?.metadata === 'object' && body.metadata !== null ? body.metadata : undefined,
  }, installation.clinicId, { okStatus: 201 });
}

export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
