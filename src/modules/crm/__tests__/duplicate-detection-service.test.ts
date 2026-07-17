import type { DuplicateDetectionRecord } from '@/modules/crm/services/duplicate-scoring-service';

const mockFindDuplicateSource = jest.fn();
const mockListDuplicateCandidates = jest.fn();
const mockUpsertCanonicalSuggestion = jest.fn();

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => {
  const actual = jest.requireActual(
    '@/modules/crm/repositories/duplicate-suggestions-repository',
  );

  return {
    ...actual,
    findDuplicateSource: (...args: unknown[]) => mockFindDuplicateSource(...args),
    listDuplicateCandidates: (...args: unknown[]) =>
      mockListDuplicateCandidates(...args),
    upsertCanonicalSuggestion: (...args: unknown[]) =>
      mockUpsertCanonicalSuggestion(...args),
  };
});

import {
  recalculateDuplicatesForLead,
  recalculateDuplicatesForPatient,
} from '@/modules/crm/services/duplicate-detection-service';
import {
  canonicalizePair,
} from '@/modules/crm/repositories/duplicate-suggestions-repository';

function patient(
  id: string,
  clinicId = 'clinic-a',
  overrides: Partial<DuplicateDetectionRecord> = {},
): DuplicateDetectionRecord {
  return {
    id,
    clinicId,
    ownerType: 'patient',
    name: `Patient ${id}`,
    phone: null,
    email: null,
    document: null,
    status: 'active',
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    relationshipCount: 0,
    ...overrides,
  };
}

function lead(
  id: string,
  clinicId = 'clinic-a',
  overrides: Partial<DuplicateDetectionRecord> = {},
): DuplicateDetectionRecord {
  return {
    ...patient(id, clinicId),
    ownerType: 'lead',
    ...overrides,
  };
}

describe('CRM duplicate detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not persist candidates below the review threshold', async () => {
    mockFindDuplicateSource.mockResolvedValue(patient('source', 'clinic-a', {
      name: 'Ana',
    }));
    mockListDuplicateCandidates.mockResolvedValue([
      patient('candidate', 'clinic-a', { name: 'Maria' }),
    ]);

    const result = await recalculateDuplicatesForPatient({
      clinicId: 'clinic-a',
      patientId: 'source',
    });

    expect({ result, upserts: mockUpsertCanonicalSuggestion.mock.calls }).toEqual({
      result: { evaluated: 1, persisted: 0 },
      upserts: [],
    });
  });

  it('persists an eligible patient pair without merge side effects', async () => {
    const source = patient('source', 'clinic-a', {
      name: 'Ana',
      phone: '11999990000',
    });
    const candidate = patient('candidate', 'clinic-a', {
      name: 'Maria',
      phone: '(11) 99999-0000',
    });
    mockFindDuplicateSource.mockResolvedValue(source);
    mockListDuplicateCandidates.mockResolvedValue([candidate]);
    mockUpsertCanonicalSuggestion.mockResolvedValue({ id: 'suggestion' });

    const result = await recalculateDuplicatesForPatient({
      clinicId: 'clinic-a',
      patientId: 'source',
    });

    expect({
      result,
      sourceLookup: mockFindDuplicateSource.mock.calls[0],
      candidateLookup: mockListDuplicateCandidates.mock.calls[0],
      suggestion: mockUpsertCanonicalSuggestion.mock.calls[0][0],
      hasStatus:
        'status' in mockUpsertCanonicalSuggestion.mock.calls[0][0],
    }).toMatchObject({
      result: { evaluated: 1, persisted: 1 },
      sourceLookup: [{ clinicId: 'clinic-a', ownerType: 'patient', ownerId: 'source' }],
      candidateLookup: [{ clinicId: 'clinic-a', ownerType: 'patient', excludeId: 'source' }],
      suggestion: {
        clinicId: 'clinic-a',
        ownerType: 'patient',
        confidence: 'medium',
        duplicateScore: 70,
      },
      hasStatus: false,
    });
  });

  it('keeps lead detection inside the lead owner and clinic', async () => {
    mockFindDuplicateSource.mockResolvedValue(lead('source'));
    mockListDuplicateCandidates.mockResolvedValue([
      lead('candidate', 'clinic-a', {
        email: 'same@example.com',
      }),
    ]);
    mockFindDuplicateSource.mockResolvedValueOnce(
      lead('source', 'clinic-a', { email: 'same@example.com' }),
    );

    await recalculateDuplicatesForLead({
      clinicId: 'clinic-a',
      leadId: 'source',
    });

    expect({
      sourceLookup: mockFindDuplicateSource.mock.calls[0][0],
      candidateLookup: mockListDuplicateCandidates.mock.calls[0][0],
    }).toEqual({
      sourceLookup: {
        clinicId: 'clinic-a',
        ownerType: 'lead',
        ownerId: 'source',
      },
      candidateLookup: {
        clinicId: 'clinic-a',
        ownerType: 'lead',
        excludeId: 'source',
      },
    });
  });

  it('canonicalizes pair order before persistence', () => {
    expect(canonicalizePair('record-b', 'record-a')).toEqual({
      leftId: 'record-a',
      rightId: 'record-b',
    });
  });
});
