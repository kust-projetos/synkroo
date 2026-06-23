import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { obterModeloLembrete } from '@/modules/operacional/actions/obter-modelo-lembrete';

interface RouteParams { params: Promise<{ id: string }>; }

async function handleGET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(obterModeloLembrete, { id, mode: 'template' });
}

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(obterModeloLembrete, { id, mode: 'preview' });
}

const wrappedGET = withModuleRoute('operacional', moduleManifest)(handleGET);
const wrappedPOST = withModuleRoute('operacional', moduleManifest)(handlePOST);

export { wrappedGET as GET, wrappedPOST as POST };
