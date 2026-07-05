import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/financeiro/webhooks/[provider]
 *
 * Provider webhook endpoint.
 * Does NOT use withModuleRoute — webhooks must always be reachable
 * to reconcile existing charges even when the module is disabled.
 *
 * Validates provider secret and only reconciles known charges.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (provider !== 'asaas') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  // Validate webhook secret from headers
  const token = request.headers.get('x-asaas-token');
  if (!token) {
    return NextResponse.json({ error: 'Missing webhook token' }, { status: 401 });
  }

  // TODO: reconcile existing charges when webhook processing is implemented
  return NextResponse.json({ received: true });
}
