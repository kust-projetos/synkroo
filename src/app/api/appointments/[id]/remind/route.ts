import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from '@/modules/operacional/ui/route-adapter';
import { gatilhoLembrete } from '@/modules/operacional/actions/gatilho-lembrete';

interface RouteParams { params: Promise<{ id: string }>; }

async function handlePOST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runActionRoute(gatilhoLembrete, { id });
}

const wrapped = withModuleRoute('operacional')(handlePOST);
export { wrapped as POST };
