import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { listLeadsByClinic } from '@/modules/comercial/repositories/leads-repository';
import { buildUserContext } from '@/core/actions/context';

/**
 * GET /api/leads/hot — Hot leads for notifications.
 * Uses repository directly (no dedicated hot-leads action for API routes).
 */
const handleGet = async (request: NextRequest) => {
  let ctx;
  try { ctx = await buildUserContext(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  const rows = await listLeadsByClinic(ctx.clinicId);

  const hotLeads = rows
    .filter((l) => l.temperature === 'hot' && (l.score || 0) >= 70 && l.status !== 'converted' && l.status !== 'lost')
    .slice(0, limit);

  return NextResponse.json({
    leads: hotLeads,
    count: hotLeads.length,
    timestamp: new Date().toISOString(),
  });
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
