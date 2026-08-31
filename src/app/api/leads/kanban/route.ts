import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { listarLeadsKanban } from '@/modules/comercial/actions/listar-leads-kanban';

/**
 * GET /api/leads/kanban — Kanban-style lead listing with stage info.
 */
const handleGet = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const stageId = searchParams.get('stage_id') || undefined;
  return runComercialAction(listarLeadsKanban, { stageId });
};

export const GET = withModuleRoute('comercial')(handleGet);
