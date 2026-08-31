import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { listGateways } from '@/modules/financeiro/services/gateway-config-service';
import { listOverdueCharges, enrichOverdueCharges } from '@/modules/financeiro/services/collection-service';
import { renderRatio } from '@/modules/financeiro/services/dashboard-service';
import { runFinanceiroAction } from '@/modules/financeiro/ui/route-adapter';
import { obterDashboard } from '@/modules/financeiro/actions/obter-dashboard';

async function handleGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = {
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
  };
  return runFinanceiroAction(obterDashboard, input);
}
export const GET = withModuleRoute('financeiro')(handleGET);
