const mockFindSuggestionById = jest.fn();
const mockListSuggestions = jest.fn();
const mockTransitionSuggestionStatus = jest.fn();
const mockRefreshSuggestionEvidence = jest.fn();
const mockFindDuplicateSource = jest.fn();

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => {
  const actual = jest.requireActual(
    '@/modules/crm/repositories/duplicate-suggestions-repository',
  );
  return {
    ...actual,
    findSuggestionById: (...args: unknown[]) => mockFindSuggestionById(...args),
    listSuggestions: (...args: unknown[]) => mockListSuggestions(...args),
    transitionSuggestionStatus: (...args: unknown[]) =>
      mockTransitionSuggestionStatus(...args),
    refreshSuggestionEvidence: (...args: unknown[]) =>
      mockRefreshSuggestionEvidence(...args),
    findDuplicateSource: (...args: unknown[]) => mockFindDuplicateSource(...args),
  };
});

import {
  listarSugestoesDuplicidade,
  obterSugestaoDuplicidade,
  aprovarSugestaoDuplicidade,
  dispensarSugestaoDuplicidade,
} from '@/modules/crm/actions';

const anyClinic = '00000000-0000-4000-8000-000000000001';
const anySuggestion = '00000000-0000-4000-8000-000000000010';

const suggestionFixture = {
  id: anySuggestion,
  clinicId: anyClinic,
  ownerType: 'patient',
  leftId: '00000000-0000-4000-8000-000000000020',
  rightId: '00000000-0000-4000-8000-000000000021',
  status: 'pending',
  confidence: 'high',
  duplicateScore: 85,
  signals: {},
  leftSnapshot: {},
  rightSnapshot: {},
  winnerSuggestedId: null,
  winnerConfirmedId: null,
  dismissReason: null,
  detectedAt: new Date(),
  refreshedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const context = {
  source: 'user' as const,
  clinicId: anyClinic,
  user: { id: 'user-1', email: 'user@test.com', name: 'User' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'user-1' },
};

describe('CRM duplicate review actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers all four review actions with crm:review_duplicates', () => {
    expect({
      list: listarSugestoesDuplicidade.requires,
      detail: obterSugestaoDuplicidade.requires,
      approve: aprovarSugestaoDuplicidade.requires,
      dismiss: dispensarSugestaoDuplicidade.requires,
    }).toEqual({
      list: 'crm:review_duplicates',
      detail: 'crm:review_duplicates',
      approve: 'crm:review_duplicates',
      dismiss: 'crm:review_duplicates',
    });
  });

  it('lists suggestions scoped by clinic', async () => {
    mockListSuggestions.mockResolvedValue([suggestionFixture]);

    const result = await listarSugestoesDuplicidade.handler(
      { clinicId: anyClinic },
      context,
    );

    expect({
      result: result.data?.length,
      lookup: mockListSuggestions.mock.calls[0],
    }).toEqual({
      result: 1,
      lookup: [anyClinic, { status: undefined, ownerType: undefined, limit: undefined, offset: undefined }],
    });
  });

  it('returns 404 when suggestion not found', async () => {
    mockFindSuggestionById.mockResolvedValue(null);

    await expect(
      obterSugestaoDuplicidade.handler({ id: anySuggestion }, context),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('transitions pending to approved with compare-and-set', async () => {
    mockFindSuggestionById.mockResolvedValue({
      ...suggestionFixture,
      status: 'pending',
    });
    mockFindDuplicateSource.mockResolvedValue({
      id: suggestionFixture.leftId,
      name: 'Ana',
      ownerType: 'patient',
      clinicId: anyClinic,
      phone: '11999990000',
      email: 'ana@example.com',
      document: '12345678900',
      status: 'active',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      relationshipCount: 0,
    });
    mockFindDuplicateSource.mockResolvedValueOnce({
      id: suggestionFixture.rightId,
      name: 'Ana Silva',
      ownerType: 'patient',
      clinicId: anyClinic,
      phone: '(11) 99999-0000',
      email: 'ANA@example.com',
      document: '123.456.789-00',
      status: 'active',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      relationshipCount: 0,
    });
    mockRefreshSuggestionEvidence.mockResolvedValue(undefined);
    mockTransitionSuggestionStatus.mockResolvedValue(true);

    const result = await aprovarSugestaoDuplicidade.handler(
      { id: anySuggestion },
      context,
    );

    expect(result).toEqual({ id: anySuggestion, status: 'approved' });
    expect(mockTransitionSuggestionStatus).toHaveBeenCalledWith(
      anySuggestion,
      ['pending', 'failed'],
      'approved',
      expect.objectContaining({ reviewedBy: 'user-1' }),
    );
  });

  it('rejects approve from merged status', async () => {
    mockFindSuggestionById.mockResolvedValue({
      ...suggestionFixture,
      status: 'merged',
    });

    await expect(
      aprovarSugestaoDuplicidade.handler({ id: anySuggestion }, context),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('dismisses from any reviewable status', async () => {
    mockFindSuggestionById.mockResolvedValue({
      ...suggestionFixture,
      status: 'pending',
    });
    mockTransitionSuggestionStatus.mockResolvedValue(true);

    await expect(
      dispensarSugestaoDuplicidade.handler(
        { id: anySuggestion, dismissReason: 'false_positive' },
        context,
      ),
    ).resolves.toMatchObject({ id: anySuggestion, status: 'dismissed' });
  });

  it('refresh below 70 dismisses instead of returning', async () => {
    mockFindSuggestionById.mockResolvedValue({
      ...suggestionFixture,
      status: 'pending',
    });
    mockFindDuplicateSource.mockResolvedValue({
      id: suggestionFixture.leftId,
      name: 'Alice',
      ownerType: 'patient',
      clinicId: anyClinic,
      phone: null,
      email: null,
      document: null,
      status: 'active',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      relationshipCount: 0,
    });
    mockFindDuplicateSource.mockResolvedValueOnce({
      id: suggestionFixture.rightId,
      name: 'Bob',
      ownerType: 'patient',
      clinicId: anyClinic,
      phone: null,
      email: null,
      document: null,
      status: 'active',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      relationshipCount: 0,
    });
    mockTransitionSuggestionStatus.mockResolvedValue(true);

    await expect(
      obterSugestaoDuplicidade.handler({ id: anySuggestion }, context),
    ).rejects.toMatchObject({ code: 'conflict' });

    expect(mockTransitionSuggestionStatus).toHaveBeenCalledWith(
      anySuggestion,
      ['pending'],
      'dismissed',
      expect.any(Object),
    );
  });

  it('export action index aggregates all seven review actions', async () => {
    const { crmDuplicateReviewActions } = await import('@/modules/crm/actions');
    const names = crmDuplicateReviewActions.map((a) => a.name).sort();
    expect(names).toEqual([
      'crm.aprovarSugestaoDuplicidade',
      'crm.dispensarSugestaoDuplicidade',
      'crm.executarMergeLead',
      'crm.executarMergePatient',
      'crm.listarSugestoesDuplicidade',
      'crm.obterSugestaoDuplicidade',
      'crm.reprocessarSugestoesDuplicidade',
    ]);
  });
});
