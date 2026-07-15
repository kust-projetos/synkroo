import { randomUUID } from 'node:crypto';

const mockFindSuggestionById = jest.fn();
const mockClaimSuggestion = jest.fn();
const mockMarkSuggestionFailed = jest.fn();
const mockFinalizeMergeAndDismissSiblings = jest.fn();
const mockFindDuplicateSource = jest.fn();

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

const mockIsPatientMerged = jest.fn();
jest.mock('@/modules/operacional/services/patient-merge-state-service', () => ({
  isPatientMerged: (...args: unknown[]) => mockIsPatientMerged(...args),
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
import { isLeaseActive, MERGE_LEASE_MS } from '../services/duplicate-execution-service';

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

  it('unapplied recovery: marks failed and throws retry-able conflict', async () => {
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

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'conflict' });

    expect(mockIsPatientMerged).toHaveBeenCalled();
    expect(mockMarkSuggestionFailed).toHaveBeenCalledWith(
      suggestionId,
      'key-stale',
      'lease_expired_recovery',
    );
    // Must NOT finalize (nothing to finalize)
    expect(mockFinalizeMergeAndDismissSiblings).not.toHaveBeenCalled();
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
    ).rejects.toMatchObject({ code: 'conflict' });

    expect(mockMarkSuggestionFailed).not.toHaveBeenCalled();
    expect(mockIsPatientMerged).not.toHaveBeenCalled();
  });

  // ── Normal flow: claim + finalize ────────────────

  it('normal flow: dispatcher succeeds, finalize wins', async () => {
    const { registerOwnerMerge } = await import('../services/duplicate-execution-service');
    registerOwnerMerge('patient', async () => true);

    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
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
  });

  // ── Finalize CAS loss → reread → merged ─────────

  it('finalize CAS loss: rereads merged and returns idempotent', async () => {
    const { registerOwnerMerge } = await import('../services/duplicate-execution-service');
    registerOwnerMerge('patient', async () => true);

    mockFindSuggestionById
      .mockResolvedValueOnce(suggestionFixture()) // initial read
      .mockResolvedValueOnce(
        suggestionFixture({ status: 'merged', mergeOperationKey: 'other-key' }),
      ); // reread after CAS loss — already merged
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('right-id', { name: 'Alice S.', phone: '(11) 99999-0000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(false); // CAS loss

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'merged' }); // idempotent
    expect(mockFindSuggestionById).toHaveBeenCalledTimes(2);
  });

  // ── Failure CAS loss → reread → merged ──────────

  it('failure CAS loss: rereads merged and returns idempotent', async () => {
    const { registerOwnerMerge } = await import('../services/duplicate-execution-service');
    registerOwnerMerge('patient', async () => false); // dispatcher returns false

    mockFindSuggestionById
      .mockResolvedValueOnce(suggestionFixture()) // initial read
      .mockResolvedValueOnce(
        suggestionFixture({ status: 'merged', mergeOperationKey: 'other-key' }),
      ); // reread after failure CAS loss
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('right-id', { name: 'Alice S.', phone: '(11) 99999-0000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockMarkSuggestionFailed.mockResolvedValue(false); // CAS loss

    const result = await executarMergePatient.handler({ id: suggestionId }, context);
    expect(result).toMatchObject({ status: 'merged' }); // idempotent
    expect(mockMarkSuggestionFailed).toHaveBeenCalled();
    expect(mockFindSuggestionById).toHaveBeenCalledTimes(2);
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
    ).rejects.toMatchObject({ code: 'conflict' });
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
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('handles non-approved status', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({ status: 'dismissed' }),
    );
    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'conflict' });
  });
});
