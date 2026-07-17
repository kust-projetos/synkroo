import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { listarCobrancasAtrasadas } from '@/modules/financeiro/actions/listar-cobrancas-atrasadas';

async function handleGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = {
    page: parseInt(searchParams.get('page') ?? '1', 10),
    limit: parseInt(searchParams.get('limit') ?? '50', 10),
  };
  return runFinanceiroAction(listarCobrancasAtrasadas, input);
}
export const GET = withModuleRoute('financeiro', moduleManifest)(handleGET);
