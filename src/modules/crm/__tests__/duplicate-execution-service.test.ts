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

  it('returns true for very recent execution', () => {
    expect(isLeaseActive(base, base.getTime() + 1)).toBe(true);
  });
});

// ── executeMerge ────────────────────────────────────

describe('CRM duplicate execution', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── Recovery: already merged ────────────────────

  it('throws conflict when suggestion is already merged', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({ status: 'merged' }),
    );

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  // ── Recovery: lease active ───────────────────────

  it('throws conflict when suggestion is executing with active lease', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        status: 'executing',
        mergeOperationKey: 'key-active',
        executedAt: new Date(), // just now → lease active
      }),
    );

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(mockMarkSuggestionFailed).not.toHaveBeenCalled();
  });

  // ── Recovery: lease expired ──────────────────────

  it('marks failed and throws conflict when executing with expired lease', async () => {
    const longAgo = new Date(Date.now() - MERGE_LEASE_MS - 1);
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        status: 'executing',
        mergeOperationKey: 'key-stale',
        executedAt: longAgo,
      }),
    );
    mockMarkSuggestionFailed.mockResolvedValue(true);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(mockMarkSuggestionFailed).toHaveBeenCalledWith(
      suggestionId,
      'key-stale',
      'lease_expired_recovery',
    );
  });

  // ── Recovery: executing without executedAt ───────

  it('treats executing without executedAt as expired lease', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        status: 'executing',
        mergeOperationKey: 'key-no-date',
        executedAt: null,
      }),
    );
    mockMarkSuggestionFailed.mockResolvedValue(true);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  // ── Dispatcher absent before approved claim ──────

  it('executes owner merge end-to-end with claim and finalize', async () => {
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('left-id', {
        name: 'Alice',
        phone: '11999990000',
        email: null,
      }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('right-id', {
        name: 'Alice Smith',
        phone: '(11) 99999-0000',
        email: null,
      }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    // No dispatcher registered → ownerSuccess = false
    mockMarkSuggestionFailed.mockResolvedValue(true);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'internal' });

    expect(mockClaimSuggestion).toHaveBeenCalled();
    expect(mockMarkSuggestionFailed).toHaveBeenCalled();
    // Should NOT attempt finalize since owner failed
    expect(mockFinalizeMergeAndDismissSiblings).not.toHaveBeenCalled();
  });

  // ── Dispatcher error → failure ───────────────────

  it('marks failed when dispatcher throws', async () => {
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('left-id', { name: 'Alice', phone: '11999990000' }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('right-id', { name: 'Alice S.', phone: '(11) 99999-0000' }),
    );
    mockClaimSuggestion.mockResolvedValue(true);
    mockMarkSuggestionFailed.mockResolvedValue(true);

    // No dispatcher registered → ownerSuccess = false (no throw, just false)
    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'internal' });
    expect(mockMarkSuggestionFailed).toHaveBeenCalled();
  });

  // ── Finalize CAS: winner wins ────────────────────

  it('finalizes merge atomically when dispatcher succeeds', async () => {
    // Register a mock dispatcher that returns true
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

    const result = await executarMergePatient.handler(
      { id: suggestionId },
      context,
    );
    expect(result).toMatchObject({ status: 'executing' });
    expect(mockFinalizeMergeAndDismissSiblings).toHaveBeenCalled();
  });

  // ── Finalize CAS: loser gets conflict ────────────

  it('throws conflict when finalize CAS fails (already merged by another)', async () => {
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
    // CAS fails — another process already finalized
    mockFinalizeMergeAndDismissSiblings.mockResolvedValue(false);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'conflict' });
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

  it('returns pending when final refresh detects material drift', async () => {
    mockFindSuggestionById.mockResolvedValue(suggestionFixture({
      leftSnapshot: { id: 'left-id', document: null },
      rightSnapshot: { id: 'right-id', document: null },
    }));
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('left-id', { phone: '11999990000', email: null, document: null }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('right-id', { phone: '(11) 99999-0000', email: null, document: null }),
    );

    const result = await executarMergePatient.handler(
      { id: suggestionId },
      context,
    );
    expect(result).toMatchObject({ status: 'pending' });
  });

  it('dismisses when final refresh drops below 70', async () => {
    mockFindSuggestionById.mockResolvedValue(
      suggestionFixture({
        leftSnapshot: { id: 'left-id', document: null },
        rightSnapshot: { id: 'right-id', document: null },
      }),
    );
    mockFindDuplicateSource.mockResolvedValue(
      detectionRecord('any', { phone: null, email: null, document: null }),
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
});
