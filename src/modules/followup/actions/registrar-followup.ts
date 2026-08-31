import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { registrarFeedback } from '../services/followup-service';

export const registrarFollowup = defineAction({
  name: 'followup.registrarFollowup',
  module: 'followup',
  requires: 'followup:manage_followups',
  label: 'Registrar follow-up manual',
  input: z.object({
    patientId: z.string().uuid(),
    appointmentId: z.string().uuid().optional(),
    feedbackType: z.string().optional().default('post_consultation'),
    rating: z.number().int().min(1).max(5).optional(),
    npsScore: z.number().int().min(0).max(10).optional(),
    comments: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    await registrarFeedback({
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      feedbackType: input.feedbackType,
      rating: input.rating,
      npsScore: input.npsScore,
      comments: input.comments,
    });
    return { success: true };
  },
});
