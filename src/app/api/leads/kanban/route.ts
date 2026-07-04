import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { listAllLeadsWithStage } from '@/modules/comercial/repositories/leads-repository';

/**
 * GET /api/leads/kanban — Kanban-style lead listing with stage info.
 * Provides snake_case response for backwards compatibility.
 */
const handleGet = async (req: NextRequest) => {
  let ctx;
  try { ctx = await buildUserContext(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(req.url);
  const stageId = searchParams.get('stage_id') || undefined;

  // Use the leads repository to fetch with stage info
  const rows = await listAllLeadsWithStage(ctx.clinicId, stageId);

  return NextResponse.json({ leads: rows });
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
