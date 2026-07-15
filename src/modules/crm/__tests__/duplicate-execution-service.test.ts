import { randomUUID } from 'node:crypto';

const mockFindSuggestionById = jest.fn();
const mockClaimSuggestion = jest.fn();
const mockMarkSuggestionFailed = jest.fn();
const mockFinalizeMergeAndDismissSiblings = jest.fn();
const mockFindDuplicateSource = jest.fn();
const mockIsPatientMerged = jest.fn();
const mockIsLeadMerged = jest.fn();
const mockScoreDuplicatePair = jest.fn();
const mockClassifyDuplicateScore = jest.fn();

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => {
  const actual = jest.requireActual(
    '@/modules/crm/repositories/duplicate-suggestions-repository',
  );
  return {
    ...actual,
    findSuggestionById: (...args: unknown[]) => mockFindSuggestionById(...args),
    findDuplicateSource: (...args: unknown[]) => mockFindDuplicateSource(...args),
  };
});

jest.mock('@/modules/crm/repositories/merge-execution-repository', () => ({
  claimSuggestion: (...args: unknown[]) => mockClaimSuggestion(...args),
  markSuggestionFailed: (...args: unknown[]) => mockMarkSuggestionFailed(...args),
  finalizeMergeAndDismissSiblings: (...args: unknown[]) =>
    mockFinalizeMergeAndDismissSiblings(...args),
}));

jest.mock('@/modules/operacional/services/patient-merge-state-service', () => ({
  isPatientMerged: (...args: unknown[]) => mockIsPatientMerged(...args),
}));

jest.mock('@/modules/comercial/services/merge-state-service', () => ({
  isLeadMerged: (...args: unknown[]) => mockIsLeadMerged(...args),
}));

jest.mock('@/modules/crm/services/duplicate-scoring-service', () => ({
  scoreDuplicatePair: (...args: unknown[]) => mockScoreDuplicatePair(...args),
  classifyDuplicateScore: (...args: unknown[]) => mockClassifyDuplicateScore(...args),
}));

// Mock DB client so tests that reach getDb() don't need a real database
jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => ({ returning: jest.fn() })) })) })),
    delete: jest.fn(() => ({ where: jest.fn(() => ({ returning: jest.fn() })) })),
  })),
}));

import {
  executarMergePatient,
  executarMergeLead,
} from '@/modules/crm/actions';
import { crmDuplicateReviewActions } from '@/modules/crm/actions';
import { isLeaseActive, MERGE_LEASE_MS, registerOwnerMerge } from '../services/duplicate-execution-service';

const clinicId = '00000000-0000-4000-8000-000000000001';
const suggestionId = '00000000-0000-4000-8000-000000000010';

const context = {
  source: 'user' as const,
  clinicId,
  user: { id: 'user-1', email: 'u@t.com', name: 'User' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'user-1' },
};

function suggestionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: suggestionId,
    clinicId,
    ownerType: 'patient',
    leftId: randomUUID(),
    rightId: randomUUID(),
    status: 'approved',
    confidence: 'high',
    duplicateScore: 85,
    signals: {},
    leftSnapshot: { id: 'left-id', document: null },
    rightSnapshot: { id: 'right-id', document: null },
    winnerSuggestedId: null,
    winnerConfirmedId: null,
    mergeOperationKey: null,
    dismissReason: null,
    failureReason: null,
    executedBy: null,
    executedAt: null,
    detectedAt: new Date(),
    refreshedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function detectionRecord(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    clinicId,
    ownerType: 'patient',
    name: `Record ${id}`,
    phone: '11999990000',
    email: null,
    document: null,
    status: 'active',
    tags: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    relationshipCount: 1,
    ...overrides,
  };
}

// ── isLeaseActive ──────────────────────────────────

describe('isLeaseActive', () => {
  const base = new Date('2026-01-15T12:00:00Z');

  it('returns true when elapsed < 30s', () => {
    expect(isLeaseActive(base, base.getTime() + 29_000)).toBe(true);
  });

  it('returns false when elapsed = 30s', () => {
    expect(isLeaseActive(base, base.getTime() + 30_000)).toBe(false);
  });

  it('returns false when elapsed > 30s', () => {
    expect(isLeaseActive(base, base.getTime() + 31_000)).toBe(false);
  });
});

// ── executeMerge ────────────────────────────────────

describe('CRM duplicate execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default scoring: high confidence, no drift (duplicateScore 85 vs score 85)
    mockScoreDuplicatePair.mockReturnValue({ score: 85, signals: {} });
    mockClassifyDuplicateScore.mockReturnValue('high');
    // Ensure a patient dispatcher is registered for normal-flow tests
    registerOwnerMerge('patient', async () => true);
  });

  // ── Applied recovery (merged already) ────────────

  it('applied recovery: finalizes without dispatcher when owner merge already applied', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    const leftId = randomUUID();
    const rightId = randomUUID();
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        status: 'executing',
        mergeOperationKey: 'key-stale',
        executedAt: longAgo,
        leftId,
        rightId,
      }),
    );
    mockIsPatientMerged.mockResolvedValue(true); // owner merge already applied
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(true);

    const result = await executarMergePatient.handler({ id: suggestionId }, context);

    expect(result).toMatchObject({ status: 'merged' });
    expect(mockIsPatientMerged).toHaveBeenCalledWith(leftId, clinicId);
    expect(mockFinalizeMergeAndDismissSiblings).toHaveBeenCalled();
    // Must NOT attempt to claim or dispatch
    expect(mockClaimSuggestion).not.toHaveBeenCalled();
  });

  it('applied recovery (lead): finalizes when lead merge already applied', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    const leftId = randomUUID();
    const rightId = randomUUID();
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        ownerType: 'lead',
        status: 'executing',
        mergeOperationKey: 'key-stale',
        executedAt: longAgo,
        leftId,
        rightId,
      }),
    );
    mockIsLeadMerged.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(true);

    const result = await executarMergeLead.handler({ id: suggestionId }, context);

    expect(result).toMatchObject({ status: 'merged' });
    expect(mockIsLeadMerged).toHaveBeenCalledWith(leftId, clinicId);
    expect(mockFinalizeMergeAndDismissSiblings).toHaveBeenCalled();
    expect(mockClaimSuggestion).not.toHaveBeenCalled();
  });

  it('applied recovery: CAS loss rereads merged and returns idempotent', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    const leftId = randomUUID();
    const rightId = randomUUID();
    mockFindSuggestionById
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'executing',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
          leftId,
          rightId,
        }),
      )
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'merged',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
          leftId,
          rightId,
        }),
      );
    mockIsPatientMerged.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(false); // CAS loss

    const result = await executarMergePatient.handler({ id: suggestionId }, context);

    // Idempotent merged outcome despite CAS loss
    expect(result).toMatchObject({ status: 'merged' });
    expect(mockFindSuggestionById).toHaveBeenCalledTimes(2);
  });

  // ── Unapplied recovery ──────────────────────────

  it('unapplied recovery: marks failed and throws retry-able conflict (unexpected state)', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        status: 'executing',
        mergeOperationKey: 'key-stale',
        executedAt: longAgo,
      }),
    );
    mockIsPatientMerged.mockResolvedValue(false); // owner merge NOT applied
    mockMarkSuggestionFailed.mockResolvedValue(true);
    // No re-read mock → refreshed is undefined → unexpected state error

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Recuperação: estado inesperado após liberar lease.',
    });

    expect(mockIsPatientMerged).toHaveBeenCalled();
    expect(mockMarkSuggestionFailed).toHaveBeenCalledWith(
      suggestionId,
      'key-stale',
      'lease_expired_recovery',
    );
    // Must NOT finalize (nothing to finalize)
    expect(mockFinalizeMergeAndDismissSiblings).not.toHaveBeenCalled();
  });

  it('unapplied recovery: marks failed, rereads failed, throws lease-expired retry', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    mockFindSuggestionById
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'executing',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
        }),
      )
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'failed',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
        }),
      );
    mockIsPatientMerged.mockResolvedValue(false);
    mockMarkSuggestionFailed.mockResolvedValue(true);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Lease expirado. Reivindique novamente.',
    });

    expect(mockMarkSuggestionFailed).toHaveBeenCalledWith(
      suggestionId,
      'key-stale',
      'lease_expired_recovery',
    );
  });

  it('unapplied recovery: CAS loss rereads merged and returns idempotent', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    mockFindSuggestionById
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'executing',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
        }),
      )
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'merged',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
        }),
      );
    mockIsPatientMerged.mockResolvedValue(false); // owner merge NOT applied
    mockMarkSuggestionFailed.mockResolvedValue(false); // CAS loss

    const result = await executarMergePatient.handler({ id: suggestionId }, context);

    // Idempotent merged outcome despite CAS loss on the recovery mark-failed
    expect(result).toMatchObject({ status: 'merged' });
    expect(mockMarkSuggestionFailed).toHaveBeenCalledWith(
      suggestionId,
      'key-stale',
      'lease_expired_recovery',
    );
    expect(mockFindSuggestionById).toHaveBeenCalledTimes(2);
  });

  it('unapplied recovery: CAS loss reread not merged throws conflict', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    mockFindSuggestionById
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'executing',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
        }),
      )
      .mockResolvedValueOnce(
        suggestionFixture({
          status: 'failed',
          mergeOperationKey: 'key-stale',
          executedAt: longAgo,
        }),
      );
    mockIsPatientMerged.mockResolvedValue(false); // owner merge NOT applied
    mockMarkSuggestionFailed.mockResolvedValue(false); // CAS loss

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Concorrência: estado alterado antes de liberar lease.',
    });
  });

  // ── Active lease ─────────────────────────────────

  it('active lease: throws conflict without marking failed', async () => {
    const now = new Date();
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        status: 'executing',
        mergeOperationKey: 'key-active',
        executedAt: now,
      }),
    );

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Concorrência: merge em execução por outro processo.',
    });

    expect(mockMarkSuggestionFailed).not.toHaveBeenCalled();
    expect(mockIsPatientMerged).not.toHaveBeenCalled();
  });

  // ── Normal flow: claim + finalize ────────────────

  it('normal flow: dispatcher succeeds, finalize wins', async () => {
    const leftId = randomUUID();
    const rightId = randomUUID();
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({ leftId, rightId }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('right-id', { name: 'Alice S.', phone: '(11) 99999-0000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(true);

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'executing' });
    expect(mockClaimSuggestion).toHaveBeenCalled();
    expect(mockFinalizeMergeAndDismissSiblings).toHaveBeenCalled();

    // Kill ObjectLiteral mutants on findDuplicateSource call shapes
    expect(mockFindDuplicateSource).toHaveBeenNthCalledWith(1, {
      clinicId,
      ownerType: 'patient',
      ownerId: leftId,
    });
    expect(mockFindDuplicateSource).toHaveBeenNthCalledWith(2, {
      clinicId,
      ownerType: 'patient',
      ownerId: rightId,
    });
    // Kill StringLiteral mutant on mergeOperationKey generation
    const claimArgs = mockClaimSuggestion.mock.calls[0];
    expect(claimArgs[2]).toEqual(expect.stringMatching(/^merge-/));
  });

  it('normal flow: honors winnerSuggestedId for winner/loser selection', async () => {
    const leftId = randomUUID();
    const rightId = randomUUID();
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({ leftId, rightId, winnerSuggestedId: rightId }),
    );
    mockFindDuplicateSource.mockResolvedValue(
      detectionRecord('left-id', { name: 'Alice' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(true);

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'executing' });
    // winner = winnerSuggestedId (rightId), loser = leftId
    expect(mockFinalizeMergeAndDismissSiblings).toHaveBeenCalledWith(
      suggestionId,
      expect.stringMatching(/^merge-/),
      clinicId,
      rightId,
      leftId,
      'patient',
    );
  });

  // ── Finalize CAS loss → reread → merged ─────────

  it('finalize CAS loss: rereads merged and returns idempotent', async () => {
    mockFindSuggestionById
      .mockResolvedValueOnce(suggestionFixture()) // initial read
      .mockResolvedValueOnce(
        suggestionFixture({ status: 'merged', mergeOperationKey: 'other-key' }),
      ); // reread after CAS loss — already merged
    mockFindDuplicateSource.mockResolvedValue(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(false); // CAS loss

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'merged' }); // idempotent
    expect(mockFindSuggestionById).toHaveBeenCalledTimes(2);
  });

  it('finalize CAS loss: reread not merged throws conflict', async () => {
    mockFindSuggestionById
      .mockResolvedValueOnce(suggestionFixture()) // initial read
      .mockResolvedValueOnce(
        suggestionFixture({ status: 'failed', mergeOperationKey: 'other-key' }),
      ); // reread after CAS loss — NOT merged
    mockFindDuplicateSource.mockResolvedValue(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(false); // CAS loss

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Concorrência: merge já finalizado.',
    });
  });

  // ── Failure CAS loss → reread → merged ──────────

  it('failure CAS loss: rereads merged and returns idempotent', async () => {
    registerOwnerMerge('patient', async () => false); // dispatcher returns false

    mockFindSuggestionById
      .mockResolvedValueOnce(suggestionFixture()) // initial read
      .mockResolvedValueOnce(
        suggestionFixture({ status: 'merged', mergeOperationKey: 'other-key' }),
      ); // reread after failure CAS loss
    mockFindDuplicateSource.mockResolvedValue(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockMarkSuggestionFailed.mockResolvedValue(false); // CAS loss

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'merged' }); // idempotent
    expect(mockMarkSuggestionFailed).toHaveBeenCalled();
    expect(mockFindSuggestionById).toHaveBeenCalledTimes(2);
  });

  it('failure CAS loss: reread not merged throws conflict', async () => {
    registerOwnerMerge('patient', async () => false); // dispatcher returns false

    mockFindSuggestionById
      .mockResolvedValueOnce(suggestionFixture()) // initial read
      .mockResolvedValueOnce(
        suggestionFixture({ status: 'failed', mergeOperationKey: 'other-key' }),
      ); // reread after failure CAS loss — NOT merged
    mockFindDuplicateSource.mockResolvedValue(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockMarkSuggestionFailed.mockResolvedValue(false); // CAS loss

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Concorrência: estado alterado antes de registrar falha.',
    });
  });

  // ── Source / candidate missing ──────────────────

  it('throws not_found when source or candidate missing', async () => {
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource
      .mockResolvedValueOnce(detectionRecord('left-id'))
      .mockResolvedValueOnce(undefined); // candidate missing

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'not_found',
      message: 'Registros de origem não encontrados.',
    });
  });

  // ── Low confidence (score below threshold) ──────

  it('dismisses and throws conflict when confidence below threshold', async () => {
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    mockScoreDuplicatePair.mockReturnValue({ score: 50, signals: {} });
    mockClassifyDuplicateScore.mockReturnValue(null); // below threshold

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Score abaixo do limiar. Sugestão dispensada.',
    });
  });

  // ── Material drift → pending ─────────────────────

  it('returns pending when material drift detected (>= 15)', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({ duplicateScore: 85 }),
    );
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    // drift = |85 - 70| = 15 → triggers pending path
    mockScoreDuplicatePair.mockReturnValue({ score: 70, signals: {} });
    mockClassifyDuplicateScore.mockReturnValue('medium'); // truthy confidence

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ id: suggestionId, status: 'pending' });
  });

  // ── Claim rejected ───────────────────────────────

  it('throws conflict when claim (CAS) fails', async () => {
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    mockClaimSuggestion.mockResolvedValue(false);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Concorrência: sugestão alterada.',
    });
  });

  // ── Dispatcher throws → owner merge fails ───────

  it('dispatcher error → marks failed and throws internal', async () => {
    registerOwnerMerge('patient', async () => {
      throw new Error('boom');
    });
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    mockClaimSuggestion.mockResolvedValue(true);
    mockMarkSuggestionFailed.mockResolvedValue(true);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'internal',
      message: 'Falha na execução do merge pelo owner.',
    });

    expect(mockMarkSuggestionFailed).toHaveBeenCalledWith(
      suggestionId,
      expect.stringMatching(/^merge-/),
      'owner_merge_failed',
    );
    expect(mockFinalizeMergeAndDismissSiblings).not.toHaveBeenCalled();
  });

  // ── No dispatcher registered → owner merge fails ─

  it('no registered dispatcher → marks failed and throws internal', async () => {
    registerOwnerMerge('patient', undefined as unknown as () => Promise<boolean>);
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    mockClaimSuggestion.mockResolvedValue(true);
    mockMarkSuggestionFailed.mockResolvedValue(true);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'internal',
      message: 'Falha na execução do merge pelo owner.',
    });

    expect(mockMarkSuggestionFailed).toHaveBeenCalled();
    expect(mockFinalizeMergeAndDismissSiblings).not.toHaveBeenCalled();
  });

  // ── Context without user (optional chaining) ────

  it('handles context without user when claiming', async () => {
    const ctxNoUser = { ...context, user: undefined };
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(true);

    const result = await executarMergePatient.handler({ id: suggestionId }, ctxNoUser);
    expect(result).toMatchObject({ status: 'executing' });
    const claimArgs = mockClaimSuggestion.mock.calls[0];
    expect(claimArgs[3]).toBeUndefined();
  });

  // ── Document conflict edge cases ─────────────────

  it('no conflict when only one side has a document', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        leftSnapshot: { id: 'left-id', document: '111.111.111-11' },
        rightSnapshot: { id: 'right-id', document: null },
      }),
    );
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(true);

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'executing' });
  });

  it('no conflict when both sides share the same document', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        leftSnapshot: { id: 'left-id', document: '111.111.111-11' },
        rightSnapshot: { id: 'right-id', document: '111.111.111-11' },
      }),
    );
    mockFindDuplicateSource.mockResolvedValue(detectionRecord('left-id'));
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(true);

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'executing' });
  });

  // ── Existing tests ──────────────────────────────

  it('rejects merge when document conflict exists', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        leftSnapshot: { id: 'left-id', document: '111.111.111-11' },
        rightSnapshot: { id: 'right-id', document: '222.222.222-22' },
      }),
    );
    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Conflito de documento entre registros.',
    });
  });

  it('requires crm:merge_patients for patient merge', () => {
    expect(executarMergePatient.requires).toBe('crm:merge_patients');
  });

  it('requires crm:merge_leads for lead merge', () => {
    expect(executarMergeLead.requires).toBe('crm:merge_leads');
  });

  it('registers both execution actions alongside review actions', () => {
    const names = crmDuplicateReviewActions.map((a) => a.name).sort();
    expect(names).toContain('crm.executarMergePatient');
    expect(names).toContain('crm.executarMergeLead');
  });

  it('handles not_found suggestion', async () => {
    mockFindSuggestionById.mockResolvedValue(null);
    await expect(
      executarMergePatient.handler({ id: 'nonexistent' }, context),
    ).rejects.toMatchObject({
      code: 'not_found',
      message: 'Sugestão não encontrada.',
    });
  });

  it('handles non-approved status', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({ status: 'dismissed' }),
    );
    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({
      code: 'conflict',
      message: 'Sugestão não aprovada.',
    });
  });
});
