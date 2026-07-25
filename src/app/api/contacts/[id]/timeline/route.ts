/**
 * /api/contacts/[id]/timeline — Task 5: gated + action-driven.
 * type ausente/inválido → 400. Caso contrário → crm.listarTimelineContato.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import { listarTimelineContato } from '@/modules/crm/actions';

async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(_request.url);
  const typeRaw = searchParams.get('type');
  if (typeRaw !== 'patient' && typeRaw !== 'lead') {
    return NextResponse.json(
      { error: 'type query parameter required (patient|lead)' },
      { status: 400 },
    );
  }
  const { id } = await params;
  return runCrmAction(listarTimelineContato, { type: typeRaw, id });
}

export const GET = withModuleRoute('crm', moduleManifest)(handleGET);