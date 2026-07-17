import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { calculateLeadScore } from '../services/lead-scoring-service';

export const qualificarLead = defineAction({
  name: 'comercial.qualificarLead',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Qualificar lead',
  input: z.object({
    source: z.string(),
    hasPhone: z.boolean(),
    hasEmail: z.boolean(),
    expressedInterest: z.boolean(),
    askedBudget: z.boolean(),
    hasTimeline: z.boolean(),
    respondedToFollowup: z.boolean(),
    previousPatient: z.boolean(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    return calculateLeadScore(input);
  },
});
