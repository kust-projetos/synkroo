import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { listLeadsByClinic } from '@/modules/comercial/repositories/leads-repository';
import { buildUserContext } from '@/core/actions/context';

/**
 * GET /api/leads/stats — Lead statistics for dashboard.
 * Uses repository directly (no dedicated stats action exists yet).
 */
const handleGet = async (_request: NextRequest) => {
  let ctx;
  try { ctx = await buildUserContext(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const rows = await listLeadsByClinic(ctx.clinicId);
  const total = rows.length;
  const byStatus: Record<string, number> = {};
  const byTemperature: Record<string, number> = {};
  let hotCount = 0;
  let totalScore = 0;

  for (const l of rows) {
    const s = l.status || 'unknown';
    const t = l.temperature || 'cold';
    byStatus[s] = (byStatus[s] || 0) + 1;
    byTemperature[t] = (byTemperature[t] || 0) + 1;
    if (t === 'hot') hotCount++;
    totalScore += l.score || 0;
  }

  return NextResponse.json({
    stats: {
      total,
      byStatus,
      byTemperature,
      hotLeads: hotCount,
      avgScore: rows.length > 0 ? Math.round(totalScore / rows.length) : 0,
    },
  });
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
