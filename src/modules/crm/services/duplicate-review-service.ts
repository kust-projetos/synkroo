import { ActionError, type ActionContext } from '@/core/actions/types';
import {
  findSuggestionById,
  refreshSuggestionEvidence,
  transitionSuggestionStatus,
} from '../repositories/duplicate-suggestions-repository';
import {
  findDuplicateSource,
} from '../repositories/duplicate-suggestions-repository';
import { scoreDuplicatePair, classifyDuplicateScore } from './duplicate-scoring-service';

export async function performLightRefresh(id: string, clinicId: string) {
  const suggestion = await findSuggestionById(clinicId, id);
  if (!suggestion) return { ok: false as const, error: new ActionError('not_found', 'Sugestão não encontrada.') };

  const source = await findDuplicateSource({
    clinicId: suggestion.clinicId,
    ownerType: suggestion.ownerType as 'patient' | 'lead',
    ownerId: suggestion.leftId,
  });
  const candidate = await findDuplicateSource({
    clinicId: suggestion.clinicId,
    ownerType: suggestion.ownerType as 'patient' | 'lead',
    ownerId: suggestion.rightId,
  });
  if (!source || !candidate) return { ok: false as const, error: new ActionError('conflict', 'Registros de origem não encontrados para refresh.') };

  const scoreResult = scoreDuplicatePair(source, candidate);
  const confidence = classifyDuplicateScore(scoreResult.score);
  const winnerId = scoreResult.score >= 70 ? (scoreResult.score > 90 ? source.id : candidate.id) : null;

  if (!confidence) {
    await transitionSuggestionStatus(id, [suggestion.status], 'dismissed', {
      dismissReason: 'score_below_threshold_after_refresh',
    });
    return { ok: false as const, error: new ActionError('conflict', 'Score abaixo do limiar após refresh.') };
  }

  await refreshSuggestionEvidence(id, {
    duplicateScore: scoreResult.score,
    confidence,
    signals: scoreResult.signals as any,
    winnerSuggestedId: winnerId,
    leftSnapshot: { id: source.id, name: source.name } as any,
    rightSnapshot: { id: candidate.id, name: candidate.name } as any,
  });

  return { ok: true as const, suggestion: { ...suggestion, duplicateScore: scoreResult.score, confidence } };
}

export async function approveSuggestion(id: string, ctx: ActionContext) {
  const suggestion = await findSuggestionById(ctx.clinicId, id);
  if (!suggestion) throw new ActionError('not_found', 'Sugestão não encontrada.');

  if (!['pending', 'failed'].includes(suggestion.status)) {
    throw new ActionError('conflict', `Não é possível aprovar sugestão com status ${suggestion.status}.`);
  }

  const result = await performLightRefresh(id, ctx.clinicId);
  if (!result.ok) throw result.error;

  const transitioned = await transitionSuggestionStatus(
    id,
    ['pending', 'failed'],
    'approved',
    { reviewedBy: ctx.user?.id, reviewedAt: new Date() },
  );
  if (!transitioned) throw new ActionError('conflict', 'Concorrência: sugestão alterada por outro processo.');

  return { id, status: 'approved' };
}

export async function dismissSuggestion(
  id: string,
  dismissReason: string,
  ctx: ActionContext,
) {
  const suggestion = await findSuggestionById(ctx.clinicId, id);
  if (!suggestion) throw new ActionError('not_found', 'Sugestão não encontrada.');

  if (!['pending', 'approved', 'failed'].includes(suggestion.status)) {
    throw new ActionError('conflict', `Não é possível dispensar sugestão com status ${suggestion.status}.`);
  }

  const transitioned = await transitionSuggestionStatus(
    id,
    ['pending', 'approved', 'failed'],
    'dismissed',
    { dismissReason: dismissReason || 'manual_dismiss', reviewedBy: ctx.user?.id, reviewedAt: new Date() },
  );
  if (!transitioned) throw new ActionError('conflict', 'Concorrência: sugestão alterada por outro processo.');

  return { id, status: 'dismissed' };
}
