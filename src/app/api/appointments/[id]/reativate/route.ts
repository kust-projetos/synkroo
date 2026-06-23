import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { reativarConsulta } from '@/modules/operacional/actions/reativar-consulta';

interface RouteParams { params: Promise<{ id: string }>; }

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(reativarConsulta, { id });
}

const wrapped = withModuleRoute('operacional', moduleManifest)(handlePOST);
export { wrapped as POST };
