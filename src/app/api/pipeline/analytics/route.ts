import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { obterAnalyticsPipeline } from '@/modules/comercial/actions/obter-analytics-pipeline';

/**
 * GET /api/pipeline/analytics — Pipeline analytics data.
 */
const handleGet = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || undefined;
  return runComercialAction(obterAnalyticsPipeline, { action });
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
