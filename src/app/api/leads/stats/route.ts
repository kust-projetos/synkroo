import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { obterEstatisticasLeads } from '@/modules/comercial/actions/obter-estatisticas-leads';

/**
 * GET /api/leads/stats — Lead statistics for dashboard.
 */
const handleGet = async (_request: NextRequest) => {
  return runComercialAction(obterEstatisticasLeads, {});
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
