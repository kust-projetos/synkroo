import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { crmDuplicateSuggestions } from '@/lib/db/schema';
import { and, eq, ne, inArray, sql } from 'drizzle-orm';
import {
  findDuplicateSource,
  findSuggestionById,
} from '../repositories/duplicate-suggestions-repository';
import {
  claimSuggestion,
  markSuggestionFailed,
  finalizeMergeAndDismissSiblings,
} from '../repositories/merge-execution-repository';
import {
  scoreDuplicatePair,
  classifyDuplicateScore,
} from '../services/duplicate-scoring-service';
import { ActionError } from '@/core/actions/types';
import type { ActionContext } from '@/core/actions/types';

// ── Lease constants ──────────────────────────────────────────────────────────

export const MERGE_LEASE_MS = 30_000;

/**
 * Pure function: is the lease still active?
 * A lease is active when the elapsed time since executedAt is less than MERGE_LEASE_MS.
 */
export function isLeaseActive(executedAt: Date, nowMs: number = Date.now()): boolean {
  return nowMs - executedAt.getTime() < MERGE_LEASE_MS;
}

// ── Owner merge dispatcher ───────────────────────────────────────────────────

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

// ── Document conflict check ─────────────────────────────────────────────────

function hasDocumentConflict(
  leftSnapshot: Record<string, unknown>,
  rightSnapshot: Record<string, unknown>,
): boolean {
  const leftDoc = (leftSnapshot?.document as string) ?? '';
  const rightDoc = (rightSnapshot?.document as string) ?? '';
  return Boolean(leftDoc && rightDoc && leftDoc !== rightDoc);
}

function detectMaterialDrift(storedScore: number, refreshScore: number): boolean {
  return Math.abs(storedScore - refreshScore) >= 15;
}

// ── Main merge execution ────────────────────────────────────────────────────

export async function executeMerge(
  id: string,
  ownerType: 'patient' | 'lead',
  ctx: ActionContext,
) {
  const suggestion = await findSuggestionById(ctx.clinicId, id);
  if (!suggestion) throw new ActionError('not_found', 'Sugestão não encontrada.');

  // ── Recovery path: suggestion is 'executing' with possibly stale lease ──
  if (suggestion.status === 'executing') {
    if (suggestion.executedAt && isLeaseActive(suggestion.executedAt)) {
      throw new ActionError('conflict', 'Concorrência: merge em execução por outro processo.');
    }
    // Lease expired — mark as failed so the caller can retry fresh
    await markSuggestionFailed(
      id,
      suggestion.mergeOperationKey ?? '',
      'lease_expired_recovery',
    );
    throw new ActionError('conflict', 'Merge anterior expirou. Tente novamente.');
  }

  if (suggestion.status !== 'approved') {
    throw new ActionError('conflict', 'Sugestão não aprovada.');
  }

  if (hasDocumentConflict(
    suggestion.leftSnapshot as any,
    suggestion.rightSnapshot as any,
  )) {
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
  if (!source || !candidate) {
    throw new ActionError('not_found', 'Registros de origem não encontrados.');
  }

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

  // ── Claim with CAS ───────────────────────────────────────────────────────
  const mergeOperationKey = `merge-${randomUUID()}`;
  const claimed = await claimSuggestion(id, ctx.clinicId, mergeOperationKey, ctx.user?.id);
  if (!claimed) {
    throw new ActionError('conflict', 'Concorrência: sugestão alterada.');
  }

  const winnerId = suggestion.winnerSuggestedId ?? suggestion.leftId;
  const loserId = winnerId === suggestion.leftId ? suggestion.rightId : suggestion.leftId;

  // ── Dispatch owner merge ─────────────────────────────────────────────────
  const dispatcher = ownerMergeRegistry.get(ownerType);
  let ownerSuccess = false;
  if (dispatcher) {
    try {
      ownerSuccess = await dispatcher(winnerId, loserId, ctx.clinicId);
    } catch {
      ownerSuccess = false;
    }
  }

  if (ownerSuccess) {
    // ── Atomic finalize + dismiss siblings ─────────────────────────────────
    const finalized = await finalizeMergeAndDismissSiblings(
      id,
      mergeOperationKey,
      ctx.clinicId,
      winnerId,
      loserId,
      ownerType,
    );
    if (!finalized) {
      // CAS failed — another process already finalized this merge
      throw new ActionError('conflict', 'Concorrência: merge já finalizado.');
    }
  } else {
    // ── Mark failed with CAS ───────────────────────────────────────────────
    await markSuggestionFailed(id, mergeOperationKey, 'owner_merge_failed');
    throw new ActionError('internal', 'Falha na execução do merge pelo owner.');
  }

  return { id, status: 'executing' };
}
