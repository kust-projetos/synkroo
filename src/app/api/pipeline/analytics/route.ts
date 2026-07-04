import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { listPipeline } from '@/modules/comercial/repositories/pipeline-repository';
import { listLeadsByClinic } from '@/modules/comercial/repositories/leads-repository';
import { buildUserContext } from '@/core/actions/context';

/**
 * GET /api/pipeline/analytics — Pipeline analytics data.
 * Uses repositories directly (no dedicated analytics service exists).
 */
const handleGet = async (request: NextRequest) => {
  let ctx;
  try { ctx = await buildUserContext(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  const stages = await listPipeline(ctx.clinicId);
  const leads_all = await listLeadsByClinic(ctx.clinicId);

  switch (action) {
    case 'conversion_by_stage': {
      const stagesWithCount = stages.map((s) => ({
        stage_id: s.id,
        name: s.name,
        total_leads: leads_all.filter((l) => l.stageId === s.id).length,
        converted: leads_all.filter((l) => l.stageId === s.id && l.status === 'converted').length,
      }));
      return NextResponse.json({ stages: stagesWithCount });
    }
    case 'avg_conversion_time': {
      const converted = leads_all.filter((l) => l.convertedAt && l.createdAt);
      const avgDays = converted.length > 0
        ? converted.reduce((sum, l) => {
            const diff = new Date(l.convertedAt!).getTime() - new Date(l.createdAt!).getTime();
            return sum + diff / (1000 * 60 * 60 * 24);
          }, 0) / converted.length
        : 0;
      return NextResponse.json({ avgDays: Math.round(avgDays * 10) / 10 });
    }
    default:
      return NextResponse.json(
        { error: 'Invalid action. Use: conversion_by_stage, avg_conversion_time' },
        { status: 400 },
      );
  }
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
