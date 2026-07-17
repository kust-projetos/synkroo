import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import {
  listSuggestions,
  findDuplicateSource,
  transitionSuggestionStatus,
} from '../repositories/duplicate-suggestions-repository';
import { scoreDuplicatePair, classifyDuplicateScore } from '../services/duplicate-scoring-service';

export const reprocessarSugestoesDuplicidade = defineAction({
  name: 'crm.reprocessarSugestoesDuplicidade',
  module: 'crm',
  requires: 'system',
  label: 'Reprocessar sugestões de duplicidade',
  input: z.object({
    clinicId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const suggestions = await listSuggestions(ctx.clinicId, {
      status: 'pending',
    });

    let evaluated = 0;
    let dismissed = 0;

    for (const suggestion of suggestions) {
      evaluated += 1;
      const leftSource = await findDuplicateSource({
        clinicId: ctx.clinicId,
        ownerType: suggestion.ownerType as 'patient' | 'lead',
        ownerId: suggestion.leftId,
      });
      const rightSource = await findDuplicateSource({
        clinicId: ctx.clinicId,
        ownerType: suggestion.ownerType as 'patient' | 'lead',
        ownerId: suggestion.rightId,
      });

      if (!leftSource || !rightSource) {
        await transitionSuggestionStatus(
          suggestion.id,
          ['pending'],
          'dismissed',
          { dismissReason: 'stale_after_merge' },
        );
        dismissed += 1;
        continue;
      }

      const score = scoreDuplicatePair(leftSource, rightSource);
      const confidence = classifyDuplicateScore(score.score);
      if (!confidence) {
        await transitionSuggestionStatus(
          suggestion.id,
          ['pending'],
          'dismissed',
          { dismissReason: 'stale_after_merge' },
        );
        dismissed += 1;
      }
    }

    return { evaluated, dismissed };
  },
});
