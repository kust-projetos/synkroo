import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { listarLeadsQuentes } from '@/modules/comercial/actions/listar-leads-quentes';

/**
 * GET /api/leads/hot — Hot leads for notifications.
 */
const handleGet = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  return runComercialAction(listarLeadsQuentes, { limit });
};

export const GET = withModuleRoute('comercial')(handleGet);
