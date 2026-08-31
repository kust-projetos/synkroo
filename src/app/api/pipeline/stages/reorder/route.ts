import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { reordenarEtapasPipeline } from '@/modules/comercial/actions/reordenar-etapas-pipeline';

const handlePatch = async (request: NextRequest) => {
  const body = await request.json();
  const { stages } = body;
  if (!Array.isArray(stages)) {
    const { NextResponse } = await import('next/server');
    return NextResponse.json({ error: 'stages array required' }, { status: 400 });
  }
  return runComercialAction(reordenarEtapasPipeline, { stages });
};

export const PATCH = withModuleRoute('comercial')(handlePatch);
