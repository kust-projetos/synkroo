const mockListSuggestions = jest.fn();
const mockTransitionSuggestionStatus = jest.fn();
const mockListDuplicateCandidates = jest.fn();
const mockUpsertCanonicalSuggestion = jest.fn();
const mockFindDuplicateSource = jest.fn();

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => {
  const actual = jest.requireActual(
    '@/modules/crm/repositories/duplicate-suggestions-repository',
  );
  return {
    ...actual,
    listSuggestions: (...args: unknown[]) => mockListSuggestions(...args),
    transitionSuggestionStatus: (...args: unknown[]) =>
      mockTransitionSuggestionStatus(...args),
    listDuplicateCandidates: (...args: unknown[]) =>
      mockListDuplicateCandidates(...args),
    upsertCanonicalSuggestion: (...args: unknown[]) =>
      mockUpsertCanonicalSuggestion(...args),
    findDuplicateSource: (...args: unknown[]) =>
      mockFindDuplicateSource(...args),
  };
});

import { reprocessarSugestoesDuplicidade } from '@/modules/crm/actions';

const anyClinic = '00000000-0000-4000-8000-000000000001';
const suggestionA = '00000000-0000-4000-8000-000000000010';
const suggestionB = '00000000-0000-4000-8000-000000000011';

function suggestion(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    clinicId: anyClinic,
    ownerType: 'patient',
    leftId: `left-${id}`,
    rightId: `right-${id}`,
    status: 'pending',
    confidence: 'high',
    duplicateScore: 85,
    signals: {},
    leftSnapshot: { id: `left-${id}` },
    rightSnapshot: { id: `right-${id}` },
    winnerSuggestedId: `left-${id}`,
    detectedAt: new Date(),
    refreshedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function record(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    clinicId: anyClinic,
    ownerType: 'patient',
    name: `Record ${id}`,
    phone: '11999990000',
    email: null,
    document: null,
    status: 'active',
    tags: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    relationshipCount: 0,
    ...overrides,
  };
}

describe('CRM duplicate reprocess', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reprocesses pending suggestions keeping valid ones', async () => {
    mockListSuggestions.mockResolvedValue([suggestion(suggestionA)]);
    mockFindDuplicateSource.mockResolvedValue(record('left-a'));

    const result = await reprocessarSugestoesDuplicidade.handler(
      {},
      { source: 'system', clinicId: anyClinic, can: () => true, hasModule: () => true, audit: { actor: 'system' } } as any,
    );

    expect(result).toMatchObject({ evaluated: 1 });
  });

  it('dismisses suggestions where source records are merged/lost', async () => {
    mockListSuggestions.mockResolvedValue([suggestion(suggestionA)]);
    mockFindDuplicateSource.mockResolvedValue(null);
    mockTransitionSuggestionStatus.mockResolvedValue(true);

    const result = await reprocessarSugestoesDuplicidade.handler(
      {},
      { source: 'system', clinicId: anyClinic, can: () => true, hasModule: () => true, audit: { actor: 'system' } } as any,
    );

    expect(result).toMatchObject({ dismissed: 1 });
    expect(mockTransitionSuggestionStatus).toHaveBeenCalled();
  });

  it('exports as system action in the CRM index', async () => {
    const { crmDuplicateReviewActions } = await import('@/modules/crm/actions');
    const names = crmDuplicateReviewActions.map((a) => a.name);
    expect(names).toContain('crm.reprocessarSugestoesDuplicidade');
  });
});
