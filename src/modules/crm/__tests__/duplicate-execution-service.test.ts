import { randomUUID } from 'node:crypto';

const mockFindSuggestionById = jest.fn();
const mockClaimSuggestionForExecution = jest.fn();
const mockMarkSuggestionMerged = jest.fn();
const mockMarkSuggestionFailed = jest.fn();
const mockDismissSiblings = jest.fn();
const mockFindDuplicateSource = jest.fn();

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => {
  const actual = jest.requireActual(
    '@/modules/crm/repositories/duplicate-suggestions-repository',
  );
  return {
    ...actual,
    findSuggestionById: (...args: unknown[]) => mockFindSuggestionById(...args),
    claimSuggestionForExecution: (...args: unknown[]) =>
      mockClaimSuggestionForExecution(...args),
    markSuggestionMerged: (...args: unknown[]) =>
      mockMarkSuggestionMerged(...args),
    markSuggestionFailed: (...args: unknown[]) =>
      mockMarkSuggestionFailed(...args),
    dismissSiblings: (...args: unknown[]) =>
      mockDismissSiblings(...args),
    findDuplicateSource: (...args: unknown[]) =>
      mockFindDuplicateSource(...args),
  };
});

import {
  executarMergePatient,
  executarMergeLead,
} from '@/modules/crm/actions';
import { crmDuplicateReviewActions } from '@/modules/crm/actions';

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
    dismissReason: null,
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

describe('CRM duplicate execution', () => {
  beforeEach(() => jest.clearAllMocks());

  it('executes an approved patient merge end-to-end', async () => {
    mockFindSuggestionById.mockResolvedValue(suggestionFixture());
    // matching phone (70) + name contained match (15) = 85, same as stored
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
    mockClaimSuggestionForExecution.mockResolvedValue({
      id: suggestionId,
      mergeOperationKey: 'key-1',
    });
    mockMarkSuggestionMerged.mockResolvedValue(undefined);
    mockDismissSiblings.mockResolvedValue(undefined);

    await expect(
      executarMergePatient.handler({ id: suggestionId }, context),
    ).rejects.toMatchObject({ code: 'internal' });

    expect(mockFindDuplicateSource).toHaveBeenCalledTimes(2);
    expect(mockFindSuggestionById).toHaveBeenCalled();
  });

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
    // phone match (70) only; stored is 85, diff 15 >= 15
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('left-id', {
        phone: '11999990000',
        email: null,
        document: null,
      }),
    );
    mockFindDuplicateSource.mockResolvedValueOnce(
      detectionRecord('right-id', {
        phone: '(11) 99999-0000',
        email: null,
        document: null,
      }),
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
      detectionRecord('any', {
        phone: null,
        email: null,
        document: null,
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
});
