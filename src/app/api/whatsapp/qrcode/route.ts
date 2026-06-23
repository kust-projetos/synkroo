import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runAtendimentoAction } from '@/modules/atendimento/ui/route-adapter';
import { obterQRCode } from '@/modules/atendimento/actions/obter-qrcode';

async function handleGET(_request: NextRequest): Promise<NextResponse> {
  return runAtendimentoAction(obterQRCode, {});
}

const wrapped = withModuleRoute('atendimento', moduleManifest)(handleGET);
export { wrapped as GET };
