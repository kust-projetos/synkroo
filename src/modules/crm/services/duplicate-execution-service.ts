import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { crmDuplicateSuggestions } from '@/lib/db/schema';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  findDuplicateSource,
  findSuggestionById,
} from '../repositories/duplicate-suggestions-repository';
import {
  scoreDuplicatePair,
  classifyDuplicateScore,
} from '../services/duplicate-scoring-service';
import { ActionError } from '@/core/actions/types';
import type { ActionContext } from '@/core/actions/types';

export interface OwnerMergeDispatcher {
  (winnerId: string, loserId: string, clinicId: string): Promise<boolean>;
}

const ownerMergeRegistry = new Map<string, OwnerMergeDispatcher>();

export function registerOwnerMerge(
  ownerType: 'patient' | 'lead',
  dispatcher: OwnerMergeDispatcher,
): void {
  ownerMergeRegistry.set(ownerType, dispatcher);
}

function hasDocumentConflict(
  leftSnapshot: Record<string, unknown>,
  rightSnapshot: Record<string, unknown>,
): boolean {
  const leftDoc = (leftSnapshot?.document as string) ?? '';
  const rightDoc = (rightSnapshot?.document as string) ?? '';
  return Boolean(leftDoc && rightDoc && leftDoc !== rightDoc);
}

function detectMaterialDrift(
  storedScore: number,
  refreshScore: number,
): boolean {
  const diff = Math.abs(storedScore - refreshScore);
  return diff >= 15;
}

export async function executeMerge(
  id: string,
  ownerType: 'patient' | 'lead',
  ctx: ActionContext,
) {
  const suggestion = await findSuggestionById(ctx.clinicId, id);
  if (!suggestion) throw new ActionError('not_found', 'Sugestão não encontrada.');
  if (suggestion.status !== 'approved') throw new ActionError('conflict', 'Sugestão não aprovada.');

  if (hasDocumentConflict(suggestion.leftSnapshot as any, suggestion.rightSnapshot as any)) {
    throw new ActionError('conflict', 'Conflito de documento entre registros.');
  }

  const source = await findDuplicateSource({
    clinicId: ctx.clinicId,
    ownerType,
    ownerId: suggestion.leftId,
  });
  const candidate = await findDuplicateSource({
    clinicId: ctx.clinicId,
    ownerType,
    ownerId: suggestion.rightId,
  });
  if (!source || !candidate) throw new ActionError('not_found', 'Registros de origem não encontrados.');

  const scoreResult = scoreDuplicatePair(source, candidate);
  const confidence = classifyDuplicateScore(scoreResult.score);

  if (!confidence) {
    await getDb()
      .update(crmDuplicateSuggestions)
      .set({
        status: 'dismissed',
        dismissReason: 'score_below_threshold_before_execution',
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(crmDuplicateSuggestions.id, id),
        eq(crmDuplicateSuggestions.status, 'approved'),
      ));
    throw new ActionError('conflict', 'Score abaixo do limiar. Sugestão dispensada.');
  }

  if (detectMaterialDrift(suggestion.duplicateScore, scoreResult.score)) {
    await getDb()
      .update(crmDuplicateSuggestions)
      .set({
        status: 'pending',
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(crmDuplicateSuggestions.id, id),
        eq(crmDuplicateSuggestions.status, 'approved'),
      ));
    return { id, status: 'pending' };
  }

  const mergeOperationKey = `merge-${randomUUID()}`;
  const claimResult: any = await getDb()
    .update(crmDuplicateSuggestions)
    .set({
      status: 'executing',
      mergeOperationKey,
      winnerConfirmedId: suggestion.winnerSuggestedId,
      executedBy: ctx.user?.id,
      executedAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(and(
      eq(crmDuplicateSuggestions.id, id),
      eq(crmDuplicateSuggestions.status, 'approved'),
    ));
  const claimed = claimResult?.rowCount !== undefined
    ? claimResult.rowCount > 0
    : true;

  if (!claimed) throw new ActionError('conflict', 'Concorrência: sugestão alterada.');

  const winnerId = suggestion.winnerSuggestedId ?? suggestion.leftId;
  const loserId = winnerId === suggestion.leftId ? suggestion.rightId : suggestion.leftId;

  const dispatcher = ownerMergeRegistry.get(ownerType);
  let ownerSuccess = false;
  if (dispatcher) {
    try {
      ownerSuccess = await dispatcher(winnerId, loserId, ctx.clinicId);
    } catch {
      ownerSuccess = false;
    }
  } else {
    ownerSuccess = true;
  }

  if (ownerSuccess) {
    await getDb()
      .update(crmDuplicateSuggestions)
      .set({ status: 'merged', updatedAt: new Date() } as any)
      .where(eq(crmDuplicateSuggestions.id, id));

    await getDb()
      .update(crmDuplicateSuggestions)
      .set({
        status: 'dismissed',
        dismissReason: 'stale_after_merge',
        updatedAt: new Date(),
      } as any)
      .where(and(
        eq(crmDuplicateSuggestions.clinicId, ctx.clinicId),
        eq(crmDuplicateSuggestions.ownerType, ownerType as any),
        ne(crmDuplicateSuggestions.id, id),
        sql`(
          ${crmDuplicateSuggestions.leftId} IN (${[winnerId, loserId].join(',')})
          OR ${crmDuplicateSuggestions.rightId} IN (${[winnerId, loserId].join(',')})
        )`,
        inArray(crmDuplicateSuggestions.status, [
          'pending',
          'approved',
        ] as any),
      ));
  } else {
    await getDb()
      .update(crmDuplicateSuggestions)
      .set({
        status: 'failed',
        failureReason: 'owner_merge_failed',
        updatedAt: new Date(),
      } as any)
      .where(eq(crmDuplicateSuggestions.id, id));
    throw new ActionError('internal', 'Falha na execução do merge pelo owner.');
  }

  return { id, status: 'executing' };
}
