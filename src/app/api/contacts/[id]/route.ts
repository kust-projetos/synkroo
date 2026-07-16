/**
 * /api/contacts/[id] — Task 5: gated por withModuleRoute('crm') + action system.
 *
 * - GET ?type=patient|lead → crm.obterContato. type ausente/inválido → 400.
 * - PUT/PATCH → 405 crm_mvp_read_only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runCrmAction, crmReadOnlyResponse } from '@/modules/crm/ui/route-adapter';
import { obterContato } from '@/modules/crm/actions';

function parseType(raw: string | null): 'patient' | 'lead' | null {
  if (raw === 'patient' || raw === 'lead') return raw;
  return null;
}

async function handleGET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(request.url);
  const type = parseType(searchParams.get('type'));
  if (!type) {
    return NextResponse.json(
      { error: 'type query parameter required (patient|lead)' },
      { status: 400 },
    );
  }
  const { id } = await params;
  return runCrmAction(obterContato, { type, id });
}

export const GET = withModuleRoute('crm', moduleManifest)(handleGET);
export const PUT = withModuleRoute('crm', moduleManifest)(crmReadOnlyResponse);
export const PATCH = withModuleRoute('crm', moduleManifest)(crmReadOnlyResponse);