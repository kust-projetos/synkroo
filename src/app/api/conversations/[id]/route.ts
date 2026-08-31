import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { obterConversa } from '@/modules/atendimento/actions/obter-conversa';

interface RouteParams { params: Promise<{ id: string }>; }

async function handleGET(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { id } = await params;
  return runAtendimentoAction(obterConversa, { id });
}

const wrapped = withModuleRoute('atendimento')(handleGET);
export { wrapped as GET };
