import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listPipeline } from '../repositories/pipeline-repository';
import { listLeadsByClinic } from '../repositories/leads-repository';

export const obterAnalyticsPipeline = defineAction({
  name: 'comercial.obterAnalyticsPipeline',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Obter analytics do pipeline',
  input: z.object({
    action: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const stages = await listPipeline(ctx.clinicId);
    const leadsAll = await listLeadsByClinic(ctx.clinicId);
    const action = input.action;

    switch (action) {
      case 'conversion_by_stage': {
        const stagesWithCount = stages.map((s) => ({
          stage_id: s.id,
          name: s.name,
          total_leads: leadsAll.filter((l) => l.stageId === s.id).length,
          converted: leadsAll.filter((l) => l.stageId === s.id && l.status === 'converted').length,
        }));
        return { stages: stagesWithCount };
      }
      case 'avg_conversion_time': {
        const converted = leadsAll.filter((l) => l.convertedAt && l.createdAt);
        const avgDays = converted.length > 0
          ? converted.reduce((sum, l) => {
              const diff = new Date(l.convertedAt!).getTime() - new Date(l.createdAt!).getTime();
              return sum + diff / (1000 * 60 * 60 * 24);
            }, 0) / converted.length
          : 0;
        return { avgDays: Math.round(avgDays * 10) / 10 };
      }
      default:
        return { error: 'Invalid action. Use: conversion_by_stage, avg_conversion_time' };
    }
  },
});
