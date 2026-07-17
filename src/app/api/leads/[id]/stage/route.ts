import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { moverLeadEtapaAction } from '@/modules/comercial/actions/mover-lead-etapa';

const handlePatch = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  return runComercialAction(moverLeadEtapaAction, { leadId: id, stageId: body.stage_id });
};

export const PATCH = withModuleRoute('comercial', moduleManifest)(handlePatch);
